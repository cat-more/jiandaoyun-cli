import { Command } from 'commander';
import { setConfig, getConfig, getConfigPath } from '../config';
import { createInterface } from 'readline';

export function register(program: Command): void {
  const cfg = program.command('config').description('配置管理');

  cfg
    .command('set')
    .argument('<key>', '配置键')
    .argument('[value]', '配置值（省略时从 stdin 读取）')
    .option('--stdin', '从 stdin 读取值（避免 shell history 记录）', false)
    .description('设置配置')
    .action(async (key, value, options) => {
      if (options.stdin) {
        const rl = createInterface({ input: process.stdin });
        value = await new Promise<string>((resolve) => {
          let data = '';
          rl.on('line', (line) => { data += line; });
          rl.on('close', () => resolve(data));
        });
      }
      if (!value) {
        console.error('错误: 请提供值或使用 --stdin');
        process.exit(1);
      }
      setConfig(key, value);
      console.log(`${key} = ${value} (已保存到 ${getConfigPath()})`);
    });

  cfg
    .command('get')
    .argument('[key]', '配置键')
    .description('查看配置')
    .action((key) => {
      const val = getConfig(key ?? undefined);
      if (val === null || (typeof val === 'object' && Object.keys(val).length === 0)) {
        console.log('未设置配置或配置文件不存在');
        return;
      }
      if (typeof val === 'string') {
        console.log(`${key} = ${val}`);
      } else {
        console.log(`配置文件: ${getConfigPath()}`);
        for (const [k, v] of Object.entries(val)) {
          console.log(`  ${k} = ${v}`);
        }
      }
    });
}
