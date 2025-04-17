// rollup.config.js
import dts from 'rollup-plugin-dts';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

// 配置1：打包代码
const codeConfig = {
  input: 'lib/h264-sps-pps-parser/dist/index.js',
  output: {
    file: './js/sps-pps.esm.js',
    format: 'esm',
    sourcemap: false
  },
  plugins: [
    resolve(), // 解析node_modules中的模块
    commonjs() // 将CommonJS模块转换为ES模块
  ]
};

// 配置2：合并声明文件
const dtsConfig = {
  input: 'lib/h264-sps-pps-parser/dist/index.d.ts', // 需要指向 tsc 生成的入口声明文件
  output: {
    file: './js/sps-pps.esm.d.ts',
    format: 'esm',
  },
  plugins: [dts()],
};

export default [codeConfig, dtsConfig];