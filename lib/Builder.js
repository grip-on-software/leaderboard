import _ from 'lodash';
import * as d3 from 'd3';
import naturalSort from 'javascript-natural-sort';
import Box from './Box';
import {CardGroup, CardLocale} from './Card';
import Drag from './Drag';

class Builder {
    constructor(locales, data, normalize, localization, links, groups, sources) {
        this.data = data;
        this.normalize = normalize;
        this.locales = locales;
        this.localization = localization;
        this.links = links;
        this.groups = groups;
        this.sources = sources;

        // Array of all project names, sorted alphabetically
        this.projects = Object.keys(data).sort(naturalSort);

        // Current selected project and feature
        this.currentProject = null;
        this.currentFeature = null;
        this.group = null;

        this.cardLocale = new CardLocale(this.locales, this.localization,
            this.normalize
        );
        this.dragCards = new Drag({
            element: '#cards',
            createCards: (old) => this.createCards(old)
        }, this.normalize);
    }

    // Show the total (average) score with a color indication
    setTotalScore() {
        if (this.group === null) {
            return;
        }
        const totalScore = this.group.getTotalScore();

        d3.select('#total-score')
            .classed('score-red score-yellow score-green', false)
            .text(this.group.getScoreText(totalScore))
            .classed('score-' + this.group.getScoreClass(totalScore), true);
    }

    setScoreMode(mode) {
        this.group.mode = mode;
        d3.selectAll('.score')
            .html(d => this.group.getScoreHtml(d));

        this.setTotalScore();
    }

    setSortOrder(order) {
        const data = d3.selectAll('.card').data()
            .map(item => _.assign(item, {x: 0, y: 0}));

        let items = _.sortBy(data, (d) => {
            if (order === 'project') {
                return d.project;
            }
            if (order === 'feature') {
                return this.locales.retrieve(this.localization, d.feature);
            }
            if (order === 'group') {
                return [this.groups[d.feature].length, this.groups[d.feature]];
            }
            if (order === 'score') {
                return this.group.getFeatureValue(d.feature, null, d.project);
            }
            if (this.currentProject !== null) {
                return _.findIndex(Object.keys(this.data[this.currentProject]), d.feature);
            }
            return d.project;
        });
        d3.select('#cards').html('');
        this.addCards(items);
    }

    // Add cards for each feature
    addCards(items) {
        this.group = new CardGroup(
            this.currentProject,
            this.currentFeature,
            this.cardLocale,
            d3.select('input[name="score"]:checked').node().value,
            this.data,
            items
        );
        d3.select('#display-name')
            .text(this.currentProject || this.group.cards[0].getFeatureTitle());

        // Base card
        const card = d3.select('#cards')
            .selectAll('.column')
            .data(this.group.cards)
            .enter()
            .append('div')
            .classed('column is-3', true)
            .append('div')
            .classed('card', true)
            .style('left', d => d.x + 'px')
            .style('top', d => d.y + 'px');

        // Set the total (average) score
        this.setTotalScore();

        // Header: Localized title and link
        const cardHeader = card.append('header')
            .classed('card-header', true);

        const title = cardHeader.append('p')
            .classed('card-header-title', true);
        title.append('span')
            .classed('ellipsized-title', true)
            .html(d => this.currentProject === null ? d.project : d.getCardTitle())
            .on("wheel", function() {
                // Show full title if scrolling purely horizontally
                if (d3.event.deltaY === 0) {
                    d3.select(this).classed('ellipsized-title', false)
                        .classed('scrollable-title', true)
                        .on("wheel", null);
                }
            });

        cardHeader.append('span')
            .classed('has-text-centered is-size-6 score', true)
            .html(d => this.group.getScoreHtml(d));

        cardHeader.append('a')
            .classed('tooltip', true)
            .attr('href', d => this.currentProject === null ? `#${d.project}` : `#${d.feature}`)
            .attr('data-tooltip', d => this.currentProject === null ?
                this.locales.message("card-swap-project", [d.project]) :
                this.locales.message("card-swap-feature", [this.locales.retrieve(this.localization, d.feature)]))
            .classed('card-header-icon', true)
            .append('span')
            .classed('icon is-small', true)
            .append('i')
            .classed('fas fa-exchange-alt', true);

        cardHeader.append('a')
            .classed('tooltip', true)
            .attr('href', d => this.links[d.project] ? this.links[d.project][d.feature].source : null)
            .attr('target', '_blank')
            .attr('data-tooltip', this.locales.message("source-link"))
            .classed('is-hidden', d => {
                // Only show the link if it is present
                if (!this.links[d.project]) {
                    return true;
                }
                return ["", " ", null].includes(this.links[d.project][d.feature].source);
            })
            .classed('card-header-icon', true)
            .append('span')
            .classed('icon is-small', true)
            .append('i')
            .attr('class', d => {
                if (this.links[d.project] && this.links[d.project][d.feature].type) {
                    const type = this.links[d.project][d.feature].type;
                    return this.sources.icon[type].join(' ');
                }
                return 'fas fa-info-circle';
            });

        // Content: Project, lead and mean values and score for each item
        const cardContent = card.append('div')
            .classed('card-content', true)
            .append('div')
            .classed('content', true)
            .append('div')
            .classed('columns is-multiline', true);

        cardContent.append('div')
            .classed('column is-4', true)
            .html(d => `<strong>${this.locales.message("score-project")}</strong>
                <br> ${this.group.getFeatureValue(d.feature, null, d.project)}`);

        cardContent.append('div')
            .classed('column is-4 clickable', true)
            .on("click", d => { location.hash = `#${this.group.getLeadProject(d.feature)}`; })
            .html(d => `<strong>${this.locales.message("score-lead")}</strong>
                <br> ${this.group.getLeadValue(d.feature)}`);

        cardContent.append('div')
            .classed('column is-4', true)
            .html(d => `<strong>${this.locales.message("score-mean")}</strong>
                <br> ${this.group.getMeanValue(d.feature)}`);

        const svg = cardContent.append('div')
            .classed('column is-12 distribution clickable', true)
            .append('svg')
            .attr('width', '200')
            .attr('height', '33');

        const group = this.group;
        svg.each(function(d) {
            let values = group.getFeatureValues(d.feature);

            let iqr = k => {
                return d => {
                    let q1 = d.quartiles[0],
                        q3 = d.quartiles[2],
                        iqr = (q3 - q1) * k,
                        i = 0,
                        j = d.length - 1;
                    while (d[i] < q1 - iqr) {
                        i++;
                    }
                    while (d[j] > q3 + iqr) {
                        j--;
                    }
                    return [i, j];
                };
            };

            let chart = (new Box())
                .whiskers(iqr(1.5))
                .width(200)
                .height(33)
                .horizontal(true)
                .domain([values[0], values[values.length-1]]);

            let svgElement = d3.select(this);
            let highlight = group.getFeatureValue(d.feature, null, d.project);
            chart.build(svgElement.append('g').datum(values), highlight);
        });

        this.dragCards.start(card);
    }

    createCards(old='project') {
        let items;
        if (old === 'same') {
            items = d3.selectAll('.card').data();
        }
        else if (this.currentProject !== null && old === 'project') {
            items = d3.selectAll('.card').data()
                .map(item => _.assign(item, {project: this.currentProject}));
        }
        else if (this.currentFeature !== null) {
            d3.selectAll('input[name="order"]:checked')
                .property('checked', false);
            items = this.projects.map((project, key) => new Object({
                feature: this.currentFeature, project: project
            }));
        }
        else {
            if (this.currentProject === null) {
                this.currentProject = this.projects[0];
            }
            d3.selectAll('input[name="order"]:checked')
                .property('checked', false);
            items = Object.keys(this.data[this.currentProject])
                .map(key => new Object({
                    feature: key, project: this.currentProject
                }));
        }
        d3.selectAll('.hide-project')
            .style('display', this.currentProject !== null ? 'none' : null);
        d3.selectAll('.hide-feature')
            .style('display', this.currentFeature !== null ? 'none' : null);
        d3.select('#cards').html('');
        this.addCards(items);
    }

    setCurrentFeature(feature) {
        if (typeof this.data[this.projects[0]][feature] === "undefined") {
            return;
        }
        this.currentProject = null;
        this.currentFeature = feature;

        d3.select('#cards').html('');
        this.createCards('feature');
    }

    setCurrentProject(project, hasProject) {
        if (!hasProject) {
            this.setCurrentFeature(project);
            return false;
        }

        const old = this.currentProject !== null ? 'project' : 'new';
        this.currentProject = project;
        this.currentFeature = null;

        // Empty the cards container and recreate the cards
        this.createCards(old);
        return true;
    }
}

export default Builder;
