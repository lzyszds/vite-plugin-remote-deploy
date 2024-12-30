import type { Plugin, ResolvedConfig } from 'vite'; // 导入 Vite 相关的类型定义
import { NodeSSH } from 'node-ssh'; // 导入 node-ssh 库，用于建立 SSH 连接
import type { Config } from 'node-ssh'; // 导入 node-ssh 的配置类型
import path from 'path'; // 导入 path 模块，用于处理文件路径
import { promises as fsPromises } from 'fs'; // 导入 fs 模块的 promises API，用于异步文件操作

// 定义服务器配置接口，继承自 node-ssh 的 Config，并添加了本地和远程目录路径的属性
interface ServerConfig extends Config {
  localDirPath?: string; // 本地目录路径，可选，默认为 Vite 的输出目录
  remoteDirPath: string;  // 远程服务器目录路径，必选
}

// 定义 Vite 插件函数，接收服务器配置作为参数
const vitePluginRemoteDeploy = (serverConfig: ServerConfig): Plugin => {
  let resolvedConfig: ResolvedConfig; // 存储 Vite 解析后的配置信息

  return {
    name: 'vite-plugin-remote-deploy', // 插件名称，用于 Vite 内部识别
    enforce: 'post', // 强制插件在其他插件之后执行，确保在构建完成后执行
    configResolved(config) {
      // 在 Vite 配置解析完成后，将解析后的配置信息存储到 resolvedConfig 变量中
      resolvedConfig = config;
    },
    async closeBundle() {
      // 在 Vite 构建完成后执行的钩子函数，用于处理上传逻辑
      // 检查 SFTP 配置是否存在 host、username、password 属性，如果不存在则抛出错误
      if (!serverConfig.host || !serverConfig.username || !serverConfig.password) {
        throw new Error('SFTP config is missing host, username, or password.');
      }

      const ssh = new NodeSSH(); // 创建 NodeSSH 实例，用于建立 SSH 连接

      // 获取本地目录路径，优先使用用户配置的 localDirPath，否则使用 Vite 的输出目录，默认为 ./dist
      const localDirPath = serverConfig.localDirPath ?? resolvedConfig.build.outDir ?? "./dist";
      try {
        // 尝试连接到远程服务器
        await ssh.connect(serverConfig);
        console.log('成功连接到服务器');

        // 定义一个递归函数，用于遍历本地目录并上传文件和创建远程目录
        async function traverseDir(localPath: string, remotePath: string) {
          // 读取本地目录下的所有文件和目录
          const entries = await fsPromises.readdir(localPath, { withFileTypes: true });

          // 遍历所有文件和目录
          for (const entry of entries) {
            // 构建本地文件/目录的完整路径
            const localEntryPath = path.join(localPath, entry.name);
            // 构建远程文件/目录的完整路径
            const remoteEntryPath = path.join(remotePath, entry.name);

            // 如果是目录
            if (entry.isDirectory()) {
              // 在远程服务器创建目录
              await ssh.execCommand(`mkdir -p "${remoteEntryPath}"`);
              // 递归遍历子目录
              await traverseDir(localEntryPath, remoteEntryPath);
              // 如果是文件
            } else if (entry.isFile()) {
              // 上传文件到远程服务器
              await ssh.putFiles([{ local: localEntryPath, remote: remoteEntryPath }]);
            }
          }
        }

        // 开始遍历本地目录，并上传文件
        await traverseDir(localDirPath, serverConfig.remoteDirPath);
        console.log('目录上传完成');

      } catch (error) {
        // 捕获上传过程中发生的错误
        console.error('目录上传过程中发生错误:', error);
      } finally {
        // 在 finally 块中，确保在任何情况下都断开 SSH 连接
        ssh.dispose();
      }
    },
  };
};

export default vitePluginRemoteDeploy; // 导出 Vite 插件函数
