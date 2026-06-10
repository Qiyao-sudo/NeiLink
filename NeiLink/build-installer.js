const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 仅在 Windows 平台运行
if (process.platform !== 'win32') {
  console.log('非 Windows 平台，跳过 Inno Setup 安装包构建');
  process.exit(0);
}

// 读取版本号
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;

// 解析 --arch 参数
let arch = 'x64';
const archIndex = process.argv.indexOf('--arch');
if (archIndex !== -1 && process.argv[archIndex + 1]) {
  arch = process.argv[archIndex + 1];
}

// 查找 ISCC.exe
const isccDefaultPath = path.join('C:', 'Program Files (x86)', 'Inno Setup 6', 'ISCC.exe');
const isccAltPath = path.join('C:', 'Program Files', 'Inno Setup 6', 'ISCC.exe');

let isccPath;
if (fs.existsSync(isccDefaultPath)) {
  isccPath = isccDefaultPath;
} else if (fs.existsSync(isccAltPath)) {
  isccPath = isccAltPath;
} else {
  console.error('错误: 未找到 ISCC.exe，请安装 Inno Setup 6');
  console.error('下载地址: https://jrsoftware.org/isdl.php');
  process.exit(1);
}

const scriptPath = path.join('installer', 'setup.iss');

// 查找 win-unpacked 目录（x64 为 win-unpacked，arm64 可能为 win-arm64-unpacked）
const releaseDir = path.join('release');
let unpackedDir = 'win-unpacked';
if (fs.existsSync(releaseDir)) {
  const dirs = fs.readdirSync(releaseDir).filter(d => d.startsWith('win') && d.endsWith('-unpacked'));
  if (dirs.length > 0) {
    // 优先匹配带架构名的目录，回退到 win-unpacked
    unpackedDir = dirs.find(d => d.includes(arch)) || dirs.find(d => d === 'win-unpacked') || dirs[0];
  }
}

const cmd = `"${isccPath}" /DMyAppVersion="${version}" /DMyAppArch="${arch}" /DMyAppUnpackedDir="${unpackedDir}" "${scriptPath}"`;

console.log(`构建 NeiLink ${version} (${arch}) 安装包...`);
console.log(`执行: ${cmd}`);

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('安装包构建完成');
} catch (error) {
  console.error('安装包构建失败');
  process.exit(1);
}
