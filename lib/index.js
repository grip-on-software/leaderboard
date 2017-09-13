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

axios.all([
    axios.get('data/project_features.json'),
    axios.get('data/project_features_normalize.json'),
    axios.get('data/project_features_localization.json'),
    axios.get('data/project_features_links.json')
])
.then(axios.spread(function (leaderboardData, normalizeData, localizationData, linksData) {
    let data = leaderboardData.data;
    let normalize = normalizeData.data;
    let localization = localizationData.data;
    let links = linksData.data;

    let roundValue = function(value, denominator, percent) {
        if (denominator == 0) {
            return 0;
        }
        const digitShift = percent ? 1000 : 100;
        const digitHold = percent ? 10 : 100
        return Math.round((value / denominator) * digitShift) / digitHold;
    }

    // Returns the card title for a feature, which is potentially being
    // normalized by another feature.
    let getCardTitle = function(feature) {
        const name = localization[feature];
        if (normalize[feature] === null) {
            return name;
        }

        return `<span class="card-title">${name}</span><span class="break">&nbsp;/&nbsp;</span> <span class="card-normalize">${localization[normalize[feature]]}</span>`;
    }

    // Returns the value of a feature, which is potentially being normalized
    // by another feature.
    let getFeatureValue = function(feature, value=null) {
        if (value === null) {
            value = data[currentProject][feature];
        }
        if (normalize[feature] === null) {
            return value;
        }

        return roundValue(value, data[currentProject][normalize[feature]]);
    }

    // Returns the score for a feature, which is relative to either the lead
    // or the mean value of the feature and is at most 100%
    let getFeatureScore = function(feature, mode = 'lead') {
        const value = getFeatureValue(feature);

        if (mode === 'mean') {
            return roundValue(value, getMeanValue(feature), true);
        }

        return roundValue(value, getLeadValue(feature), true);
    }

    // Returns the total score for the current project. This is the average of
    // all other scores, and depends on the mode (lead or mean)
    let getTotalScore = function() {
        const mode = d3.select('input[name="score"]:checked').node().value;

        let totalFeatures = 0;
        let totalScore = 0;

        _.forEach(localization, (i, feature) => {
            totalFeatures += 1;
            totalScore += getFeatureScore(feature, mode);
        });

        return roundValue(totalScore, totalFeatures);
    }

    // Returns a string indicating how good the given score is
    let getScoreClass = function(score) {
        if (score >= 40 && score <= 75) {
            return 'yellow';
        } else if (score > 75) {
            return 'green';
        }

        return 'red';
    }

    // Get the HTML content for a score element
    let getScoreHtml = function(feature, mode) {
        const score = getFeatureScore(feature, mode);

        return `<span class="score-${getScoreClass(score)}">${score}%</span>`;
    }

    // Show the total (average) score with a color indication
    let setTotalScore = function() {
        const totalScore = getTotalScore();

        d3.select('#total-score')
            .classed('score-red score-yellow score-green', false)
            .text(totalScore + '%')
            .classed('score-' + getScoreClass(totalScore), true);
    }

    // Add cards for each feature
    let addCards = function(items=null) {
        if (items === null) {
            items = Object.keys(data[currentProject])
                .map(key => new Object({key: key, x: 0, y: 0}));
        }

        d3.select('#project-name')
            .text(currentProject);
        
        // Set the total (average) score
        setTotalScore();

        // Base card
        const card = d3.select('#cards')
            .selectAll('.column')
            .data(items)
            .enter()
            .append('div')
            .classed('column is-3', true)
            .append('div')
            .classed('card', true)
            .style('left', d => d.x + 'px')
            .style('top', d => d.y + 'px');

        // Header: Localized title and link
        const cardHeader = card.append('header')
            .classed('card-header', true);

        cardHeader.append('p')
            .classed('card-header-title', true)
            .html(d => getCardTitle(d.key));
        
        cardHeader.append('a')
            .attr('href', d => links[currentProject][d.key].source)
            .attr('target', '_blank')
            .classed('is-hidden', d => {
                // Only show the link if it is present
                return ["", " ", null].includes(links[currentProject][d.key].source);
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
                return `<strong>Project</strong><br> ${getFeatureValue(d.key)}`
            });

        cardContent.append('div')
            .classed('column is-4 clickable', true)
            .on("click", d => setCurrentProject(getLeadProject(d.key)))
            .html(d => {
                return `<strong>Lead</strong><br> ${getLeadValue(d.key)}`
            });

        cardContent.append('div')
            .classed('column is-4', true)
            .html(d => {
                return `<strong>Mean</strong><br> ${getMeanValue(d.key)}`
            });

        cardContent.append('div')
            .classed('column is-12 has-text-centered is-size-5 score', true)
            .html(d => getScoreHtml(d.key, d3.select('input[name="score"]:checked').node().value));

        let startDrag = function() {
            d3.select('#cards').classed('drag-area', true);
            var dragCard = d3.select(this).classed('dragging', true);
            var start = d3.mouse(document.body);
            var currentX = dragCard.datum().x;
            var currentY = dragCard.datum().y;
            var prevUnderElement = d3.selectAll([]);
            var droppableTransition = d3.transition().duration(200).ease(d3.easeLinear);
            d3.event.on("drag", d => {
                // Retrieve viewport coordinates of the mouse event
                const viewX = start[0] - d.x + d3.event.x - (document.documentElement.scrollLeft || document.body.scrollLeft);
                const viewY = start[1] - d.y + d3.event.y - (document.documentElement.scrollTop || document.body.scrollTop);

                var underElement = findCards(viewX, viewY);
                if (!underElement.empty()) {
                    d3.selectAll('.droppable').classed('droppable', false);
                    underElement.classed('droppable', true);
                }
                prevUnderElement = underElement;

                currentX += d3.event.dx;
                currentY += d3.event.dy;
                dragCard.style('left', currentX + 'px').style('top', currentY + 'px');
            }).on("end", () => {
                var transitionElement = dragCard;
                var mustRecreate = false;
                if (!prevUnderElement.empty()) {
                    var dropCard = d3.select(prevUnderElement.node());

                    const dragd = dragCard.datum();
                    const dropd = dropCard.datum();

                    if (normalize[dropd.key] === null) {
                        // Normalize the card under the dragged card.
                        normalize[dropd.key] = dragd.key;
                        mustRecreate = true;
                    }
                    else if (normalize[dropd.key] === dragd.key) {
                        // Toggle-remove the normalization of the dragged card.
                        normalize[dropd.key] = null;
                        mustRecreate = true;
                    }
                    else {
                        // Swap the dragged card with the first droppable card.
                        // Only using CSS, DOM order is preserved.

                        var dragNode = dragCard.node().parentNode;
                        var dropNode = dropCard.node().parentNode;

                        dropCard.datum(d => new Object({
                            key: d.key,
                            x: dragd.x + (dragNode.offsetLeft - dropNode.offsetLeft),
                            y: dragd.y + (dragNode.offsetTop - dropNode.offsetTop)
                        }));
                        dragCard.datum(d => new Object({
                            key: d.key,
                            x: dropd.x + (dropNode.offsetLeft - dragNode.offsetLeft),
                            y: dropd.y + (dropNode.offsetTop - dragNode.offsetTop)
                        }));
                        transitionElement = d3.selectAll([dragCard.node(), prevUnderElement.node()]);
                    }
                }
                transitionElement.transition().duration(200).ease(d3.easeLinear)
                    .style('left', d => d.x + 'px')
                    .style('top', d => d.y + 'px')
                    .on('end', d => {
                        d3.select('#cards').classed('drag-area', false);
                        if (mustRecreate) {
                            recreateCards();
                        }
                        else {
                            d3.selectAll('.card').classed('droppable', false);
                            dragCard.classed('dragging', false);
                        }
                    });
            });
        };
        card.call(d3.drag().container(document.body).on("start", startDrag));
    }

    let recreateCards = function() {
        const items = d3.selectAll('.card').data();
        d3.select('#cards').html('');
        addCards(items);
    }

    // Find all cards under a point. During drag and drop, it ignores the card
    // that is currently being dragged.
    let findCards = function(viewX, viewY) {
        if (typeof document.elementsFromPoint === "function") {
            return d3.selectAll(document.elementsFromPoint(viewX, viewY))
                .filter('.card:not(.dragging)');
        }
        return d3.selectAll('.card:not(.dragging)').filter(function() {
            const rect = this.getBoundingClientRect();
            return rect.left <= viewX && viewX <= rect.left + rect.width &&
                rect.top <= viewY && viewY <= rect.top + rect.height;
        });
    }

    // Array of all project names, sorted alphabetically
    const projects = Object.keys(data).sort(naturalSort);

    // Current selected project name
    let currentProject = projects[0];

    let setCurrentProject = function(project) {
        currentProject = project;
        d3.selectAll('#navigation ul li')
            .classed('is-active', d => d === project);

        // Empty the cards container and recreate the cards
        recreateCards();
    }

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
            setCurrentProject(project);
        });

    // Determine the lead and mean values
    let leadValues = _.clone(data[currentProject]);
    let leadProjects = {};
    let totalValues = {};        

    // Look through each project and determine the lead values
    _.forEach(data, (p, n) => {
        _.forEach(p, (i, k) => {
            // Add to the total values if the key already is in the object,
            // otherwise add the key to the object with this value
            if (totalValues[k]) {
                totalValues[k] += i;
            } else {
                totalValues[k] = i;
            }

            // If this value is higher than the one currently in the lead values,
            // use this one instead.
            if (p[k] > leadValues[k]) {
                leadValues[k] = i;
                leadProjects[k] = n;
            }
        });
    });

    let getLeadProject = function(feature) {
        return leadProjects[feature];
    };

    let getLeadValue = function(feature) {
        return getFeatureValue(feature, leadValues[feature]);
    }

    let getMeanValue = function(feature) {
        const totalValue = getFeatureValue(feature, totalValues[feature]);
        // calculate the mean for the value, with at most two decimals
        return roundValue(totalValue, projects.length);
    }

    // Finally, create the cards for the current selected project
    addCards();

    // Change the score when a different type is selected
    d3.selectAll('input[name=score]').on('change', function() {
        d3.selectAll('.score')
            .html(d => getScoreHtml(d.key, this.value));
        
        setTotalScore();
    });

    // Display the content and stop the loading spinner
    d3.select('#content').classed('is-hidden', false);

    loadingSpinner.stop();
}))
.catch(function (error) {
    console.log(error);
    loadingSpinner.stop();
    d3.select('#error-message')
        .classed('is-hidden', false)
        .text('Could not load data: ' + error);
});
