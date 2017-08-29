import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import spinner from './spinner';
import naturalSort from 'javascript-natural-sort';

const loadingSpinner = new spinner({
    width: d3.select('#container').node().clientWidth,
    height: 100,
    startAngle: 220,
    container: '#container',
    id: 'loading-spinner'
});
loadingSpinner.start();

axios.all([axios.get('data/project_features.json'), axios.get('localization.json')])
    .then(axios.spread(function (leaderboardData, localizationData) {
        let data = leaderboardData.data;
        let localization = localizationData.data;

        let addCards = function() {
            let items = Object.keys(data[currentProject]);

            d3.select('#project-name')
                .text(currentProject);

            const card = d3.select('#cards')
                .selectAll('.column')
                .data(items)
                .enter()
                .append('div')
                .classed('column is-2', true)
                .append('div')
                .classed('card', true);

            card.append('header')
                .classed('card-header', true)
                .append('p')
                .classed('card-header-title', true)
                .text(d => localization[d].name);

            card.append('div')
                .classed('card-content', true)
                .append('div')
                .classed('content', true)
                .append('div')
                .classed('columns', true)
                .append('div')
                .classed('column', true)
                .text(d => data[currentProject][d]);
        }

        const projects = Object.keys(data).sort(naturalSort);

        // Current selected project name
        let currentProject = projects[0];

        // Create project navigation
        d3.select('#navigation ul')
            .selectAll('li')
            .data(projects)
            .enter()
            .append('li')
            .classed('is-active', d => d === currentProject)
            .append('a')
            .text(d => d)
            .on('click', (project) => {
                currentProject = project;
                d3.selectAll('#navigation ul li').classed('is-active', d => d === project);

                d3.select('#cards').html('');
                addCards();
            });

        addCards();

        d3.select('#content').style('display', 'block');

        loadingSpinner.stop();
    }))
    .catch(function (error) {
        console.log(error);
        loadingSpinner.stop();
        d3.select('#error-message')
            .style('display', 'block')
            .text('Could not load data: ' + error);
    });
