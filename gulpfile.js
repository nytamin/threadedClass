'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify-es').default;
var rename = require('gulp-rename')
var sourcemaps = require('gulp-sourcemaps');
var log = require('gulplog');

gulp.task('browserify-main', function () {

	var b = browserify({
		entries: './dist/index.js',
		standalone: 'ThreadedClass',
		debug: true
	});
	return b.bundle()
		.pipe(source('app.js'))
		.pipe(rename("threadedClass.js"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});
gulp.task('browserify-worker', function () {

	var b = browserify({
		entries: './dist/threadedClass-worker.js',
		debug: true
	});
	return b.bundle()
		.pipe(source('app.js'))
		.pipe(rename("threadedClass-worker.js"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});
gulp.task('minify-main', function () {

	var b = browserify({
		entries: './dist/index.js',
		standalone: 'ThreadedClass',
		debug: true
	});
	return b.bundle()
		.pipe(source('app.js'))
		.pipe(rename("threadedClass.min.js"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(uglify())
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});
gulp.task('minify-worker', function () {

	var b = browserify({
		entries: './dist/threadedClass-worker.js',
		debug: true
	});
	return b.bundle()
		.pipe(source('app.js'))
		.pipe(rename("threadedClass-worker.min.js"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		.pipe(uglify())
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});

gulp.task('browserify', gulp.parallel([
	'browserify-main',
	'browserify-worker',
	'minify-main',
	'minify-worker'
]))

gulp.task('copy-browser-examples', function () {
	return gulp.src('./examples/browser/**/*.*').pipe(gulp.dest('./docs/examples'))
})
gulp.task('copy-browser-js', function () {
	return gulp.src('./dist/js/**/*.*').pipe(gulp.dest('./docs/examples/lib/'))
})
gulp.task('copy-to-docs', gulp.parallel([
	'copy-browser-examples',
	'copy-browser-js'
]))
