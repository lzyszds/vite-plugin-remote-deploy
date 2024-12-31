import type { Plugin } from 'vite';
import type { Config } from 'node-ssh';
interface ServerConfig extends Config {
    localDirPath?: string;
    remoteDirPath: string;
}
declare const vitePluginRemoteDeploy: (serverConfig: ServerConfig) => Plugin;
export default vitePluginRemoteDeploy;
