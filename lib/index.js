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

        // Returns the score for a feature, which is relative to either the lead
        // or the mean value of the feature and is at most 100%
        let getFeatureScore = function(feature, type = 'lead') {
            const value = data[currentProject][feature];

            if (type === 'mean') {
                return Math.min(Math.round((value / meanValues[feature]) * 1000) / 10, 100);
            }

            return Math.round((value / leadValues[feature]) * 1000) / 10;
        }

        // Add cards for each feature
        let addCards = function() {
            let items = Object.keys(data[currentProject]);

            d3.select('#project-name')
                .text(currentProject);

            // Base card
            const card = d3.select('#cards')
                .selectAll('.column')
                .data(items)
                .enter()
                .append('div')
                .classed('column is-3', true)
                .append('div')
                .classed('card', true);

            // Header: Localized title and link
            const cardHeader = card.append('header')
                .classed('card-header', true);

            cardHeader.append('p')
                .classed('card-header-title', true)
                .text(d => localization[d].name);
            
            cardHeader.append('a')
                .attr('href', d => localization[d].link)
                .attr('target', '_blank')
                .classed('is-hidden', d => {
                    // Only show the link if it is present
                    return ["", " ", null].includes(localization[d].link);
                })
                .classed('card-header-icon', true)
                .append('span')
                .classed('icon is-small', true)
                .append('i')
                .classed('fa fa-info-circle', true);

            // Content: Project, lead and mean values and score for each item
            const cardContent = card.append('div')
                .classed('card-content', true)
                .append('div')
                .classed('content', true)
                .append('div')
                .classed('columns is-multiline', true);

            cardContent.append('div')
                .classed('column is-4', true)
                .html(d => {
                    return `<strong>Project</strong><br> ${data[currentProject][d]}`
                });

            cardContent.append('div')
                .classed('column is-4', true)
                .html(d => {
                    return `<strong>Lead</strong><br> ${leadValues[d]}`
                });

            cardContent.append('div')
                .classed('column is-4', true)
                .html(d => {
                    return `<strong>Mean</strong><br> ${meanValues[d]}`
                });

            cardContent.append('div')
                .classed('column is-12 has-text-centered is-size-5 score', true)
                .text(d => `${getFeatureScore(d, d3.select('input[name="score"]:checked').node().value)} %`);
        }

        // Array of all project names, sorted alphabetically
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

                // Empty the cards container and recreate the cards
                d3.select('#cards').html('');
                addCards();
            });

        // Determine the lead and mean values
        let leadValues = _.clone(data[currentProject]);
        let meanValues = {};        
    
        // Look through each project and determine the lead values
        _.forEach(data, p => {
           _.forEach(p, (i, k) => {
               // Add to the total values if the key already is in the object,
               // otherwise add the key to the object with this value
               if (meanValues[k]) {
                   meanValues[k] += i;
               } else {
                   meanValues[k] = i;
               }

               // If this value is higher than the one currently in the lead values,
               // use this one instead.
               if (p[k] > leadValues[k]) {
                   leadValues[k] = i;
               }
           });
        });

        // meanValues now holds the total for all values, calculate the mean for each key,
        // with at most two decimals
        _.forEach(meanValues, (item, key) => {
            meanValues[key] = Math.round((item / projects.length) * 100) / 100;
        });

        // Finally, create the cards for the current selected project
        addCards();

        // Change the score when a different type is selected
        d3.selectAll('input[name=score]').on('change', function() {
            d3.selectAll('.score')
                .text(d => `${getFeatureScore(d, this.value)} %`);
        });

        // Display the content and stop the loading spinner
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
