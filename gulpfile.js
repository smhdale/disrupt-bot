const gulp = require('gulp')
const sass = require('gulp-sass')
const browserSync = require('browser-sync').create()

gulp.task('browserSync', () => {
  browserSync.init({
    server: {
      baseDir: 'public'
    }
  })
})

gulp.task('sass', () => {
  return gulp.src('public/scss/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('public/css'))
    .pipe(browserSync.reload({
      stream: true
    }))
})

gulp.task('watch', [ 'browserSync', 'sass' ], () => {
  gulp.watch('public/scss/*.scss', [ 'sass' ])
  gulp.watch('public/*.html', browserSync.reload)
  gulp.watch('public/**/*.js', browserSync.reload)
})
