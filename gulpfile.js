'use strict'; //eslint-disable-line strict

//-------------------------------------------------------------------------------
// Requires
//-------------------------------------------------------------------------------

const bugcore           = require('bugcore');
const config            = require('config');
const gulp              = require('gulp');
const babel             = require('gulp-babel');
const cloudformation    = require('gulp-cloudformation');
const eslint            = require('gulp-eslint');
const jest              = require('gulp-jest-iojs');
const sourcemaps        = require('gulp-sourcemaps');
const util              = require('gulp-util');


//-------------------------------------------------------------------------------
// Simplify references
//-------------------------------------------------------------------------------

const _                 = bugcore.ObjectUtil;


//-------------------------------------------------------------------------------
// Gulp Properties
//-------------------------------------------------------------------------------

const sources = {
    babel: [
        'src/**',
        '!**/tests/**'
    ],
    lint: [
        'src/**/*.js',
        '!node_modules/**'
    ],
    stacks: [
        'aws/stacks/*.json'
    ]
};


//-------------------------------------------------------------------------------
// Gulp Tasks
//-------------------------------------------------------------------------------

gulp.task('default', ['prod']);

gulp.task('prod', ['babel']);

gulp.task('dev', ['babel', 'lint', 'babel-watch', 'lint-watch']);

gulp.task('test', ['lint']);

gulp.task('deploy', ['cloudformation', 'firebase-deploy-rules']);


gulp.task('babel', function() {
    return gulp.src(sources.babel)
        .pipe(sourcemaps.init({
            loadMaps: true
        }))
        .pipe(babel({
            presets: ['es2015', 'stage-2']
        }))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('./dist'))
        .on('error', function(error) {
            util.log(error);
        });
});

gulp.task('lint', function() {
    return gulp.src(sources.lint)
        .pipe(eslint())
        .pipe(eslint.formatEach())
        .pipe(eslint.failAfterError())
        .on('error', function(error) {
            util.log('Stream Exiting With Error', error);
            throw error;
        });
});

gulp.task('cloudformation', function() {
    return gulp.src(sources.stacks)
        .pipe(cloudformation.init(_.assign({region: 'us-east-1'}, config.get('aws'))))
        .pipe(cloudformation.deploy({
            Capabilities: [ 'CAPABILITY_IAM' ]
        }))
        .on('error', function(error) {
            util.log('Stream Exiting With Error', error);
            throw error;
        });
});

gulp.task('firebase-deploy-rules', function() {

});


//-------------------------------------------------------------------------------
// Gulp Watchers
//-------------------------------------------------------------------------------

gulp.task('babel-watch', function() {
    gulp.watch(sources.babel, ['babel']);
});

gulp.task('lint-watch', function() {
    const lintAndPrint = eslint();
    lintAndPrint.pipe(eslint.formatEach());

    return gulp.watch('src/**/*.js', function(event) {
        if (event.type !== 'deleted') {
            gulp.src(event.path)
                .pipe(lintAndPrint, {end: false})
                .on('error', function(error) {
                    util.log(error);
                });
        }
    });
});
