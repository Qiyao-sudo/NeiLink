import * as crypto from 'crypto';
import * as fs from 'fs';
import { Transform, TransformCallback } from 'stream';

export function generateKey(bits: number = 256): string {
  const keyLength = bits / 8;
  return crypto.randomBytes(keyLength).toString('hex');
}

export function encryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

      const readStream = fs.createReadStream(inputPath);
      const writeStream = fs.createWriteStream(outputPath);

      writeStream.write(iv);

      readStream.on('error', (err) => {
        reject(new Error(`读取文件失败: ${err.message}`));
      });

      writeStream.on('error', (err) => {
        reject(new Error(`写入加密文件失败: ${err.message}`));
      });

      writeStream.on('finish', () => {
        resolve();
      });

      readStream.pipe(cipher).pipe(writeStream);
    } catch (err) {
      reject(new Error(`加密初始化失败: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}

export function decryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const readStream = fs.createReadStream(inputPath);

      let iv: Buffer | null = null;

      const onReadable = () => {
        if (iv === null) {
          iv = readStream.read(16) as Buffer | null;
          if (!iv) {
            return;
          }
          if (iv.length < 16) {
            readStream.destroy();
            reject(new Error('加密文件格式错误：无法读取IV'));
            return;
          }
          readStream.removeListener('readable', onReadable);

          try {
            const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
            const writeStream = fs.createWriteStream(outputPath);

            readStream.on('error', (err) => {
              reject(new Error(`读取加密文件失败: ${err.message}`));
            });

            writeStream.on('error', (err) => {
              reject(new Error(`写入解密文件失败: ${err.message}`));
            });

            writeStream.on('finish', () => {
              resolve();
            });

            readStream.pipe(decipher).pipe(writeStream);
          } catch (err) {
            reject(new Error(`解密初始化失败: ${err instanceof Error ? err.message : String(err)}`));
          }
        }
      };

      readStream.on('readable', onReadable);

      readStream.on('error', (err) => {
        reject(new Error(`读取加密文件失败: ${err.message}`));
      });
    } catch (err) {
      reject(new Error(`解密初始化失败: ${err instanceof Error ? err.message : String(err)}`));
    }
  });
}

class DecryptTransform extends Transform {
  private keyBuffer: Buffer;
  private decipher: ReturnType<typeof crypto.createDecipheriv> | null = null;
  private ivBuffer: Buffer;
  private ivCollected: boolean = false;
  private ivOffset: number = 0;

  constructor(key: string) {
    super();
    try {
      this.keyBuffer = Buffer.from(key, 'hex');
      if (this.keyBuffer.length !== 32) {
        throw new Error(`密钥长度错误: 期望32字节, 实际${this.keyBuffer.length}字节`);
      }
    } catch (err) {
      throw new Error(`密钥格式错误: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.ivBuffer = Buffer.alloc(16);
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      if (!this.ivCollected) {
        const remaining = 16 - this.ivOffset;
        if (chunk.length >= remaining) {
          chunk.copy(this.ivBuffer, this.ivOffset, 0, remaining);
          this.ivOffset = 16;
          this.ivCollected = true;
          
          try {
            this.decipher = crypto.createDecipheriv('aes-256-cbc', this.keyBuffer, this.ivBuffer);
          } catch (err) {
            callback(new Error(`解密器初始化失败: ${err instanceof Error ? err.message : String(err)}`));
            return;
          }

          const rest = chunk.subarray(remaining);
          if (rest.length > 0 && this.decipher) {
            try {
              this.push(this.decipher.update(rest));
            } catch (err) {
              callback(new Error(`解密数据失败: ${err instanceof Error ? err.message : String(err)}`));
              return;
            }
          }
          callback();
        } else {
          chunk.copy(this.ivBuffer, this.ivOffset);
          this.ivOffset += chunk.length;
          callback();
        }
      } else {
        if (!this.decipher) {
          callback(new Error('解密器未初始化'));
          return;
        }
        try {
          this.push(this.decipher.update(chunk));
          callback();
        } catch (err) {
          callback(new Error(`解密数据失败: ${err instanceof Error ? err.message : String(err)}`));
        }
      }
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      if (!this.ivCollected) {
        callback(new Error('加密文件格式错误: 文件太短，无法读取IV'));
        return;
      }
      if (this.decipher) {
        try {
          const final = this.decipher.final();
          if (final.length > 0) {
            this.push(final);
          }
          callback();
        } catch (err) {
          callback(new Error(`解密最终块失败: ${err instanceof Error ? err.message : String(err)} (可能是密钥错误或文件损坏)`));
        }
      } else {
        callback(new Error('解密器未初始化'));
      }
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export function createDecryptTransform(key: string): Transform {
  return new DecryptTransform(key);
}
