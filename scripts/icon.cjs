const sharp = require('sharp');
const fs = require('node:fs/promises');
(async()=>{
 await fs.mkdir('assets/dayplate.iconset',{recursive:true});
 await sharp('assets/dayplate.svg').png().toFile('assets/dayplate.png');
 for(const size of [16,32,128,256,512]) for(const scale of [1,2]) {
  await sharp('assets/dayplate.svg').resize(size*scale).png().toFile(`assets/dayplate.iconset/icon_${size}x${size}${scale===2?'@2x':''}.png`);
 }
})().catch(e=>{console.error(e);process.exit(1)});
