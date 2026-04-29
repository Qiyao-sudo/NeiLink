/**
 * AES 加密解密模块
 * 使用 Node.js 内置 crypto 模块实现文件加密解密
 */

import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * 生成随机加密密钥
 * @param bits 密钥位数，支持 128 或 256
 * @returns hex 格式的密钥字符串
 */
export function generateKey(bits: 128 | 256 = 256): string {
  const keyLength = bits / 8; // 128位=16字节, 256位=32字节
  return crypto.randomBytes(keyLength).toString('hex');
}

/**
 * 使用 AES-256-CBC 加密文件（流式处理，支持大文件）
 * 文件格式: [IV(16字节)][加密数据]
 *
 * @param inputPath 原始文件路径
 * @param outputPath 加密后文件输出路径
 * @param key hex 格式的密钥字符串
 */
export function encryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 从 hex 字符串创建密钥 Buffer
      const keyBuffer = Buffer.from(key, 'hex');

      // 生成随机 IV（16字节）
      const iv = crypto.randomBytes(16);

      // 创建加密器
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

      // 创建写入流
      const outputStream = fs.createWriteStream(outputPath);

      // 先写入 IV
      outputStream.write(iv);

      // 创建读取流并通过加密器管道传输
      const inputStream = fs.createReadStream(inputPath);

      inputStream
        .pipe(cipher)
        .pipe(outputStream);

      outputStream.on('finish', () => {
        resolve();
      });

      outputStream.on('error', (err) => {
        reject(new Error(`加密文件写入失败: ${err.message}`));
      });

      inputStream.on('error', (err) => {
        reject(new Error(`加密文件读取失败: ${err.message}`));
      });
    } catch (err) {
      reject(new Error(`加密失败: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}

/**
 * 使用 AES-256-CBC 解密文件（流式处理，支持大文件）
 * 文件格式: [IV(16字节)][加密数据]
 *
 * @param inputPath 加密文件路径
 * @param outputPath 解密后文件输出路径
 * @param key hex 格式的密钥字符串
 */
export function decryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 从 hex 字符串创建密钥 Buffer
      const keyBuffer = Buffer.from(key, 'hex');

      // 创建读取流
      const inputStream = fs.createReadStream(inputPath);

      // 读取前 16 字节作为 IV
      inputStream.once('readable', () => {
        try {
          const iv = inputStream.read(16);

          if (!iv || iv.length !== 16) {
            inputStream.destroy();
            reject(new Error('无效的加密文件格式：无法读取IV'));
            return;
          }

          // 创建解密器
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

          // 创建写入流
          const outputStream = fs.createWriteStream(outputPath);

          // 将剩余数据通过解密器管道传输
          inputStream
            .pipe(decipher)
            .pipe(outputStream);

          outputStream.on('finish', () => {
            resolve();
          });

          outputStream.on('error', (err) => {
            reject(new Error(`解密文件写入失败: ${err.message}`));
          });

          decipher.on('error', (err) => {
            reject(new Error(`解密失败（密钥可能不正确）: ${err.message}`));
          });
        } catch (err) {
          inputStream.destroy();
          reject(new Error(`解密初始化失败: ${err instanceof Error ? err.message : String(err)}`));
        }
      });

      inputStream.on('error', (err) => {
        reject(new Error(`解密文件读取失败: ${err.message}`));
      });
    } catch (err) {
      reject(new Error(`解密失败: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}

/**
 * 创建加密流（用于实时传输，不落地本地文件）
 * 返回加密器和使用的 IV
 *
 * @param key hex 格式的密钥字符串
 * @param iv 可选的自定义 IV（用于断点续传）
 * @returns 包含 cipher 和 iv 的对象
 */
export function createEncryptStream(
  key: string,
  iv?: Buffer
) {
  const keyBuffer = Buffer.from(key, 'hex');
  const finalIv = iv || crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, finalIv);
  return { cipher, iv: finalIv };
}
