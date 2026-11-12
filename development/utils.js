const product = process.env.COCO_PRODUCT || 'codecombat'
const productSuffix = { codecombat: 'coco', ozaria: 'ozar' }[product]
const publicFolderName = process.env.COCO_PUBLIC_DIR || 'public_' + productSuffix

module.exports = {
  product,
  productSuffix,
  publicFolderName,
}
