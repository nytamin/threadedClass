'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify-es').default;
var rename = require('gulp-rename')
var sourcemaps = require('gulp-sourcemaps');
var log = require('gulplog');


/*
gulp.task('tsify', function () {
	// set up the browserify instance on a task basis
	var tsify = require('tsify');

	return browserify()
		.add('./src/index.ts')
		.plugin(tsify, { noImplicitAny: true })
		.on('error', function (error) { console.error(error.toString()); })
		.bundle()
		// .pipe(buffer())
		// .pipe(sourcemaps.write('./'))
		.pipe(source('app.js'))
		.pipe(rename("threadedclass.js"))
		// .pipe(buffer())
		// .pipe(sourcemaps.init({loadMaps: true}))
		// .on('error', log.error)
		// .pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))

		// .pipe(process.stdout);
})
*/
gulp.task('browserify', function () {

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
		// Add transformation tasks to the pipeline here.
		// .pipe(uglify())
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});
gulp.task('browserify-worker', function () {

	var b = browserify({
		entries: './dist/threadedClass-worker.js',
		// standalone: 'ThreadedClassWorker',
		debug: true
	});
	return b.bundle()
		.pipe(source('app.js'))
		.pipe(rename("threadedClass-worker.js"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		// Add transformation tasks to the pipeline here.
		// .pipe(uglify())
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});

gulp.task('minify', function () {
	// set up the browserify instance on a task basis
	var b = browserify({
		entries: './dist/index.js',
		standalone: 'ThreadedClass',
		debug: false
	});
	return b.bundle()
		.pipe(source('app.js'))
		.pipe(rename("threadedclass.min.js"))
		.pipe(buffer())
		.pipe(sourcemaps.init({loadMaps: true}))
		// Add transformation tasks to the pipeline here.
		.pipe(uglify())
		.on('error', log.error)
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest('./dist/js/'))
});
