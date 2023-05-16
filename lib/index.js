/**
 * Entry point for the leaderboard visualization.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
 * Copyright 2017-2023 Leon Helwerda
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
import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import naturalSort from 'javascript-natural-sort';
import Builder from './Builder';
import spec from './locales.json';
import config from 'config.json';
import {Locale, Navigation, Navbar, Spinner} from '@gros/visualization-ui';

const locales = new Locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));
const loadingSpinner = new Spinner({
    width: d3.select('#container').node().clientWidth,
    height: 100,
    startAngle: 220,
    container: '#container',
    id: 'loading-spinner'
});
loadingSpinner.start();

axios.all([
    axios.get('data/project_features.json'),
    axios.get('data/project_features_normalize.json'),
    axios.get('data/project_features_localization.json'),
    axios.get('data/project_features_links.json'),
    axios.get('data/project_features_groups.json')
])
.then(axios.spread(function (leaderboardData, normalizeData, localizationData, linksData, groupsData) {
    const data = leaderboardData.data;
    const normalize = normalizeData.data;
    const localization = localizationData.data;
    const links = linksData.data;
    const groups = groupsData.data;

    const build = new Builder(locales, data, {
        normalize, localization, links, groups
    });

    // Array of all project names, sorted alphabetically
    const projects = Object.keys(data).sort(naturalSort);

    const projectsNavigation = new Navigation({
        setCurrentItem: (project, hasProject) => build.setCurrentProject(project, hasProject)
    });

    projectsNavigation.start(projects);

    // Finally, create the cards for the current selected project
    build.createCards('new');

    // Change the score when a different type is selected
    d3.selectAll('input[name=score]').on('change', function() {
        build.setScoreMode(this.value);
    });

    // Reorder the cards when a different order is selected
    d3.selectAll('input[name=order]').on('change', () => {
        build.setSortOrder(d3.select('input[name="order"]:checked').node().value);
    });

    // Display the content and stop the loading spinner
    d3.select('#content').classed('is-hidden', false);

    loadingSpinner.stop();
}))
.catch(function (error) {
    loadingSpinner.stop();
    d3.select('#error-message')
        .classed('is-hidden', false)
        .text(locales.message("error-data", [error]));
    throw error;
});

locales.updateMessages(d3.select('body'), [], null);

if (typeof window.buildNavigation === "function") {
    window.buildNavigation(Navbar, locales, _.assign({}, config, {
        visualization: "leaderboard"
    }));
}
