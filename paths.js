const DB_PATH = '/data/'
const IMAGE_PATH = '/images/'

module.exports = {
  image: fname => __dirname + IMAGE_PATH + fname,
  db: dbname => __dirname + DB_PATH + dbname,
  serve: fname => `https://smhdale.com.au:2096/${fname}`
}
