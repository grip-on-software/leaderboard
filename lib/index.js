import * as d3 from 'd3';
import axios from 'axios';
import naturalSort from 'javascript-natural-sort';
import builder from './builder';
import spec from './locales.json';
import config from 'config.json';
import {locale, navigation, navbar, spinner} from '@gros/visualization-ui';

const locales = new locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));
const loadingSpinner = new spinner({
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
    axios.get('data/project_features_locales.json'),
    axios.get('data/project_features_links.json'),
    axios.get('data/project_features_groups.json'),
    axios.get('data/project_features_sources.json')
])
.then(axios.spread(function (leaderboardData, normalizeData, localizationData, linksData, groupsData, sourcesData) {
    let data = leaderboardData.data;
    let normalize = normalizeData.data;
    let localization = localizationData.data;
    let links = linksData.data;
    let groups = groupsData.data;
    let sources = sourcesData.data;

    const build = new builder(locales, data, normalize, localization, links, groups, sources);

    // Array of all project names, sorted alphabetically
    const projects = Object.keys(data).sort(naturalSort);

    let projectsNavigation = new navigation({
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

locales.updateMessages();

window.buildNavigation(navbar, locales, config);
