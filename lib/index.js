import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import box from './box';
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
    axios.get('data/project_features_links.json'),
    axios.get('data/project_features_groups.json')
])
.then(axios.spread(function (leaderboardData, normalizeData, localizationData, linksData, groupsData) {
    let data = leaderboardData.data;
    let normalize = normalizeData.data;
    let localization = localizationData.data;
    let links = linksData.data;
    let groups = groupsData.data;

    // Array of all project names, sorted alphabetically
    const projects = Object.keys(data).sort(naturalSort);

    // Current selected project name
    let currentProject = projects[0];
    let currentFeature = null;

    let roundValue = function(value, denominator, percent) {
        if (denominator == 0) {
            return 0;
        }
        const digitShift = percent ? 1000 : 100;
        const digitHold = percent ? 10 : 100;
        return Math.round((value / denominator) * digitShift) / digitHold;
    };

    // Returns the card title for a feature, which is potentially being
    // normalized by another feature.
    let getCardTitle = function(feature) {
        const name = localization[feature];
        if (normalize[feature] === null) {
            return `<span class="card-title">${name}</span>`;
        }

        return `<span class="card-title">${name}</span><span class="break">&nbsp;/&nbsp;</span> <span class="card-normalize">${localization[normalize[feature]]}</span>`;
    };

    let getFeatureTitle = function(feature) {
        const name = localization[feature];
        if (normalize[feature] === null) {
            return name;
        }

        return `${name} / ${localization[normalize[feature]]}`;
    };

    // Returns the value of a feature, which is potentially being normalized
    // by another feature.
    let getFeatureValue = function(feature, value=null, project=currentProject) {
        if (value === null) {
            value = data[project][feature];
        }
        if (normalize[feature] === null) {
            return value;
        }

        return roundValue(value, data[project][normalize[feature]]);
    };

    let getFeatureRanks = function(feature) {
        return _.sortBy(_.keys(data), key => -getFeatureValue(feature, data[key][feature], key));
    };

    let getFeatureValues = function(feature) {
        let values = _.mapValues(data, (features, key) => getFeatureValue(feature, features[feature], key));
        return _.sortBy(values, value => value);
    };

    // Returns the score for a feature, which is relative to either the lead
    // or the mean value of the feature and is at most 100%
    let getFeatureScore = function(feature, mode='lead', project=currentProject) {
        if (mode === 'rank') {
            return _.findIndex(getFeatureRanks(feature), value => value === project) + 1;
        }

        const value = getFeatureValue(feature, null, project);

        if (mode === 'mean') {
            return roundValue(value, getMeanValue(feature), true);
        }

        return roundValue(value, getLeadValue(feature), true);
    };

    // Returns the total score for the current project. This is the average of
    // all other scores, and depends on the mode (lead or mean)
    let getTotalScore = function(mode) {
        let totalFeatures = 0;
        let totalScore = 0;

        d3.selectAll('.card').each(d => {
            totalFeatures += 1;
            totalScore += getFeatureScore(d.key, mode, d.project);
        });

        let value = roundValue(totalScore, totalFeatures);
        return mode === 'rank' ? Math.round(value) : value;
    };

    // Returns a string indicating how good the given score is
    let getScoreClass = function(score, mode) {
        if (mode === 'rank') {
            if (score >= 4 && score <= 10) {
                return 'yellow';
            } else if (score < 4) {
                return 'green';
            }
            return 'red';
        }

        if (score >= 40 && score <= 75) {
            return 'yellow';
        } else if (score > 75) {
            return 'green';
        }

        return 'red';
    };

    let getScoreText = function(score, mode) {
        return mode === 'rank' ? `#${score}` : `${score}%`;
    };

    // Get the HTML content for a score element
    let getScoreHtml = function(data, mode) {
        const score = getFeatureScore(data.key, mode, data.project);
        const scoreClass = getScoreClass(score, mode);
        const text = getScoreText(score, mode);

        return `<span class="score-${scoreClass}">${text}</span>`;
    };

    // Show the total (average) score with a color indication
    let setTotalScore = function() {
        const mode = d3.select('input[name="score"]:checked').node().value;
        const totalScore = getTotalScore(mode);

        d3.select('#total-score')
            .classed('score-red score-yellow score-green', false)
            .text(getScoreText(totalScore, mode))
            .classed('score-' + getScoreClass(totalScore, mode), true);
    };

    let orderCards = function() {
        const order = d3.select('input[name="order"]:checked').node().value;
        const data = d3.selectAll('.card').data()
            .map(item => _.assign(item, {x: 0, y: 0}));

        let items = _.sortBy(data, (d) => {
            if (order === 'project') {
                return d.project;
            }
            if (order === 'feature') {
                return localization[d.key];
            }
            if (order === 'group') {
                return [groups[d.key].length, groups[d.key]];
            }
            if (order === 'score') {
                return getFeatureValue(d.key, null, d.project);
            }
            if (currentProject !== null) {
                return _.findIndex(Object.keys(data[currentProject]), d.key);
            }
            return d.project;
        });
        d3.select('#cards').html('');
        addCards(items);
    };

    let getDropNormalize = function(dragData, dropData) {
        if (dragData.key === dropData.key) {
            // Never normalize cards with the same feature (different projects)
            return null;
        }
        if (normalize[dragData.key] === dropData.key) {
            // Never normalize the card under the dragged card with the dragged
            // card's feature if it is normalized with the drop card feature.
            return null;
        }
        if (normalize[dropData.key] === null) {
            // Normalize the card under the dragged card.
            return dragData.key;
        }
        if (normalize[dropData.key] === dragData.key) {
            // Toggle-remove the normalization of the dragged card.
            return dropData.key;
        }
        // No normalization
        return null;
    };

    // Add cards for each feature
    let addCards = function(items) {
        d3.select('#display-name')
            .text(currentProject || getFeatureTitle(currentFeature));
        
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

        // Set the total (average) score
        setTotalScore();

        // Header: Localized title and link
        const cardHeader = card.append('header')
            .classed('card-header', true);

        const title = cardHeader.append('p')
            .classed('card-header-title', true);
        title.append('span')
            .classed('ellipsized-title', true)
            .html(d => currentProject === null ? d.project : getCardTitle(d.key))
            .on("wheel", function() {
                // Show full title if scrolling purely horizontally
                if (d3.event.deltaY == 0) {
                    d3.select(this).classed('ellipsized-title', false)
                        .classed('scrollable-title', true)
                        .on("wheel", null);
                }
            });

        cardHeader.append('span')
            .classed('has-text-centered is-size-6 score', true)
            .html(d => getScoreHtml(d, d3.select('input[name="score"]:checked').node().value));

        cardHeader.append('a')
            .on('click', d => currentProject === null ? setCurrentProject(d.project) : setCurrentFeature(d.key))
            .classed('card-header-icon', true)
            .append('span')
            .classed('icon is-small', true)
            .append('i')
            .classed('fa fa-exchange', true);
        
        cardHeader.append('a')
            .attr('href', d => links[d.project] ? links[d.project][d.key].source : null)
            .attr('target', '_blank')
            .classed('is-hidden', d => {
                // Only show the link if it is present
                if (!links[d.project]) {
                    return true;
                }
                return ["", " ", null].includes(links[d.project][d.key].source);
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
                return `<strong>Project</strong><br> ${getFeatureValue(d.key, null, d.project)}`;
            });

        cardContent.append('div')
            .classed('column is-4 clickable', true)
            .on("click", d => setCurrentProject(getLeadProject(d.key)))
            .html(d => {
                return `<strong>Lead</strong><br> ${getLeadValue(d.key)}`;
            });

        cardContent.append('div')
            .classed('column is-4', true)
            .html(d => {
                return `<strong>Mean</strong><br> ${getMeanValue(d.key)}`;
            });

        const svg = cardContent.append('div')
            .classed('column is-12 distribution clickable', true)
            .append('svg')
            .attr('width', '200')
            .attr('height', '33');
        svg.each(function(d) {
            let values = getFeatureValues(d.key);

            let iqr = k => {
                return d => {
                    let q1 = d.quartiles[0],
                        q3 = d.quartiles[2],
                        iqr = (q3 - q1) * k,
                        i = -1,
                        j = d.length;
                    while(d[++i] < q1 - iqr);
                    while(d[--j] > q3 + iqr);
                    return [i, j];
                };
            };

            let chart = box()
                .whiskers(iqr(1.5))
                .width(200)
                .height(33)
                .horizontal(true)
                .domain([values[0], values[values.length-1]]);

            let svgElement = d3.select(this);
            let highlight = getFeatureValue(d.key, null, d.project);
            svgElement.append('g')
                .datum(values)
                .call(chart, highlight);
        });

        let startDrag = function() {
            d3.select('#cards').classed('drag-area', true);
            var dragCard = d3.select(this).classed('drag-card', true);
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
                var overDroppable = false;
                if (!underElement.empty()) {
                    d3.selectAll('.droppable').classed('droppable', false);
                    underElement.classed('droppable', true);

                    if (getDropNormalize(dragCard.datum(), underElement.datum()) !== null) {
                        overDroppable = true;
                    }
                }
                dragCard.classed('over-droppable', overDroppable);
                prevUnderElement = underElement;

                currentX += d3.event.dx;
                currentY += d3.event.dy;
                dragCard.classed('dragging', true).style('left', currentX + 'px').style('top', currentY + 'px');
            }).on("end", () => {
                var transitionElement = dragCard;
                var mustRecreate = false;
                if (!prevUnderElement.empty()) {
                    var dropCard = d3.select(prevUnderElement.node());

                    const dragData = dragCard.datum();
                    const dropData = dropCard.datum();
                    const normalizeKey = getDropNormalize(dragData, dropData);

                    if (normalizeKey !== null) {
                        mustRecreate = true;
                        normalize[dropData.key] = normalizeKey === dropData.key ? null : normalizeKey;
                    }
                    else {
                        // Swap the dragged card with the first droppable card.
                        // Only using CSS, DOM order is preserved.

                        var dragNode = dragCard.node().parentNode;
                        var dropNode = dropCard.node().parentNode;

                        dropCard.datum(d => new Object({
                            key: d.key,
                            project: d.project,
                            x: dragData.x + (dragNode.offsetLeft - dropNode.offsetLeft),
                            y: dragData.y + (dragNode.offsetTop - dropNode.offsetTop)
                        }));
                        dragCard.datum(d => new Object({
                            key: d.key,
                            project: d.project,
                            x: dropData.x + (dropNode.offsetLeft - dragNode.offsetLeft),
                            y: dropData.y + (dropNode.offsetTop - dragNode.offsetTop)
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
                            calculateScores();
                            createCards('same');
                        }
                        else {
                            d3.selectAll('.card').classed('droppable', false);
                            dragCard.classed('drag-card dragging over-droppable', false);
                        }
                    });
            });
        };
        card.call(d3.drag().container(document.body).on("start", startDrag));
    };

    let createCards = function(old='project') {
        let items;
        if (old === 'same') {
            items = d3.selectAll('.card').data();
        }
        else if (currentProject !== null && old === 'project') {
            items = d3.selectAll('.card').data()
                .map(item => _.assign(item, {project: currentProject}));
        }
        else if (currentFeature !== null) {
            d3.selectAll('input[name="order"]:checked')
                .property('checked', false);
            items = projects.map((project, key) => new Object({
                key: currentFeature, project: project, x: 0, y: 0
            }));
        }
        else {
            d3.selectAll('input[name="order"]:checked')
                .property('checked', false);
            items = Object.keys(data[currentProject])
                .map(key => new Object({
                    key: key, project: currentProject, x: 0, y: 0
                }));
        }
        d3.selectAll('.hide-project')
            .style('display', currentProject !== null ? 'none' : null);
        d3.selectAll('.hide-feature')
            .style('display', currentFeature !== null ? 'none' : null);
        d3.select('#cards').html('');
        addCards(items);
    };

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
    };

    let setCurrentProject = function(project) {
        const old = currentProject !== null ? 'project' : 'new';
        currentProject = project;
        currentFeature = null;
        d3.selectAll('#navigation ul li')
            .classed('is-active', d => d === project);

        // Empty the cards container and recreate the cards
        createCards(old);
    };

    let setCurrentFeature = function(feature) {
        currentProject = null;
        currentFeature = feature;

        d3.selectAll('#navigation ul li')
            .classed('is-active', false);

        d3.select('#cards').html('');
        createCards('feature');
    };

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
    let leadValues = {};
    let leadProjects = {};
    let meanValues = {};

    let calculateScores = function() {
        leadValues = _.mapValues(data[currentProject || projects[0]], () => 0);
        leadProjects = {};
        meanValues = {};

        // Look through each project and determine the lead values
        _.forEach(data, (p, n) => {
            _.forEach(p, (i, k) => {
                // Add to the total values if the key already is in the object,
                // otherwise add the key to the object with this value
                const v = getFeatureValue(k, i, n);
                if (meanValues[k]) {
                    meanValues[k] += v;
                } else {
                    meanValues[k] = v;
                }

                // If this value is higher than the one currently in the lead
                // values, use this one instead.
                if (v > leadValues[k]) {
                    leadValues[k] = v;
                    leadProjects[k] = n;
                }
            });
        });
    };

    let getLeadProject = function(feature) {
        return leadProjects[feature];
    };

    let getLeadValue = function(feature) {
        return leadValues[feature];
    };

    let getMeanValue = function(feature) {
        // calculate the mean for the value, with at most two decimals
        return roundValue(meanValues[feature], projects.length);
    };

    // Calculate the lead and mean values
    calculateScores();

    // Finally, create the cards for the current selected project
    createCards('new');

    // Change the score when a different type is selected
    d3.selectAll('input[name=score]').on('change', function() {
        d3.selectAll('.score')
            .html(d => getScoreHtml(d, this.value));
        
        setTotalScore();
    });

    // Reorder the cards when a different order is selected
    d3.selectAll('input[name=order]').on('change', orderCards);

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
