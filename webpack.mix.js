/**
 * Entry point for the laravel-mix/webpack compilation of the leaderboard.
 *
 * Copyright (C) 2017-2020 ICTU
 * Copyright (C) 2017-2022 Leiden University
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
const fs = require('fs'),
      path = require('path'),
      _ = require('lodash'),
      mix = require('laravel-mix'),
      HtmlWebpackPlugin = require('html-webpack-plugin');

let config = process.env.LEADERBOARD_CONFIGURATION;
if (config === undefined || !fs.existsSync(config)) {
    config = path.resolve(__dirname, 'config.json');
}
if (!fs.existsSync(config)) {
    config = path.resolve(__dirname, 'lib/config.json');
}

const configuration = _.mapValues(JSON.parse(fs.readFileSync(config)),
    value => value.replace('$organization',
        typeof process.env.VISUALIZATION_ORGANIZATION !== 'undefined' ?
        process.env.VISUALIZATION_ORGANIZATION : ''
    )
);

Mix.paths.setRootPath(__dirname);
mix.setPublicPath('public/')
    .setResourceRoot('')
    .js('lib/index.js', 'public/bundle.js')
    .sass('res/main.scss', 'public/main.css')
    .browserSync({
        proxy: false,
        server: 'public',
        files: [
            'public/**/*.js',
            'public/**/*.css'
        ]
    })
    .babelConfig({
        "env": {
            "test": {
                "plugins": [ "istanbul" ]
            }
        }
    })
    .webpackConfig({
        output: {
            path: path.resolve('public/'),
            publicPath: (configuration.path === "" ? "" : configuration.path + "/")
        },
        module: {
            rules: [ {
                test: /\.mustache$/,
                loader: 'mustache-loader',
                options: {
                    tiny: true,
                    render: Object.assign({}, configuration)
                }
            } ]
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: 'template/index.mustache',
                inject: 'body'
            })
        ],
        resolve: {
            alias: {
                'config.json$': config
            }
        }
    });

// Full API
// mix.js(src, output);
// mix.react(src, output); <-- Identical to mix.js(), but registers React Babel compilation.
// mix.extract(vendorLibs);
// mix.sass(src, output);
// mix.less(src, output);
// mix.stylus(src, output);
// mix.browserSync('my-site.dev');
// mix.combine(files, destination);
// mix.babel(files, destination); <-- Identical to mix.combine(), but also includes Babel compilation.
// mix.copy(from, to);
// mix.copyDirectory(fromDir, toDir);
// mix.minify(file);
// mix.sourceMaps(); // Enable sourcemaps
// mix.version(); // Enable versioning.
// mix.disableNotifications();
// mix.setPublicPath('path/to/public');
// mix.setResourceRoot('prefix/for/resource/locators');
// mix.autoload({}); <-- Will be passed to Webpack's ProvidePlugin.
// mix.webpackConfig({}); <-- Override webpack.config.js, without editing the file directly.
// mix.then(function () {}) <-- Will be triggered each time Webpack finishes building.
// mix.options({
//   extractVueStyles: false, // Extract .vue component styling to file, rather than inline.
//   processCssUrls: true, // Process/optimize relative stylesheet url()'s. Set to false, if you don't want them touched.
//   purifyCss: false, // Remove unused CSS selectors.
//   uglify: {}, // Uglify-specific options. https://webpack.github.io/docs/list-of-plugins.html#uglifyjsplugin
//   postCss: [] // Post-CSS options: https://github.com/postcss/postcss/blob/master/docs/plugins.md
// });
