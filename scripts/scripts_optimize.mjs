import sharp from 'sharp';
await sharp('public/img/poster-src.png').resize({width:900}).webp({quality:72}).toFile('public/img/poster-900.webp');
await sharp('public/img/poster-src.png').resize({width:1600}).webp({quality:70}).toFile('public/img/poster-1600.webp');
// ribbon-only crop (lower half) for texture/backdrop use
await sharp('public/img/poster-src.png').extract({left:0,top:520,width:1024,height:760}).resize({width:1280}).webp({quality:70}).toFile('public/img/ribbon-1280.webp');
// logo: trim black, keep symbol+wordmark
await sharp('public/img/iccpi-logo-src.png').extract({left:95,top:95,width:310,height:290}).png({compressionLevel:9}).toFile('public/img/iccpi-logo.png');
await sharp('public/img/iccpi-logo-src.png').extract({left:95,top:95,width:310,height:290}).webp({quality:85}).toFile('public/img/iccpi-logo.webp');
console.log('ok');
