/**
 * Leaderboard cards.
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

class CardGroup {
    constructor(project, feature, locale, mode, data) {
        this.project = project;
        this.feature = feature;
        this.locale = locale;
        this.mode = mode;
        this.data = data;

        this.cards = [];
        this.leadValues = {};
        this.leadProjects = {};
        this.meanValues = {};

        this.calculateScores();
    }

    getLeadProject(feature) {
        return this.leadProjects[feature];
    }

    getLeadValue(feature) {
        return this.leadValues[feature];
    }

    getMeanValue(feature) {
        // calculate the mean for the value, with at most two decimals
        return this.roundValue(this.meanValues[feature], _.size(this.data));
    }

    // Determine the lead and mean values
    calculateScores() {
        const project = this.project === null ? _.keys(this.data)[0] : this.project;
        this.leadValues = _.mapValues(this.data[project], () => 0);
        this.leadProjects = {};
        this.meanValues = {};

        // Look through each project and determine the lead values
        _.forEach(this.data, (p, n) => {
            _.forEach(p, (i, k) => {
                // Add to the total values if the key already is in the object,
                // otherwise add the key to the object with this value
                const v = this.getFeatureValue(k, i, n);
                if (this.meanValues[k]) {
                    this.meanValues[k] += v;
                } else {
                    this.meanValues[k] = v;
                }

                // If this value is higher than the one currently in the lead
                // values, use this one instead.
                if (v > this.leadValues[k]) {
                    this.leadValues[k] = v;
                    this.leadProjects[k] = n;
                }
            });
        });
    }

    buildCards(items) {
        this.cards = [];
        _.forEach(items, item => {
            this.cards.push(new Card(item.feature, item.project,
                this.data[item.project][item.feature], this.locale
            ));
        });
    }

    roundValue(value, denominator, percent) {
        if (denominator === 0) {
            return 0;
        }
        const digitShift = percent ? 1000 : 100;
        const digitHold = percent ? 10 : 100;
        return Math.round((value / denominator) * digitShift) / digitHold;
    }

    // Returns the value of a feature, which is potentially being normalized
    // by another feature.
    getFeatureValue(feature, value=null, project=null) {
        const card = _.find(this.cards,
            d => d.feature === feature && (project === null || d.project === project)
        );
        if (value === null) {
            value = card ? card.getRawValue() : this.data[project || this.project][feature];
        }

        const normalize = card ? card.getNormalize() :
            this.locale.getNormalize(feature);
        if (normalize === null) {
            return value;
        }

        return this.roundValue(value, (this.cards[normalize] ?
            this.cards[normalize].getRawValue() :
            this.data[project || this.project][normalize]
        ));
    }

    getFeatureRanks(feature) {
        return _.sortBy(_.keys(this.data),
            project => -this.getFeatureValue(feature, null, project)
        );
    }

    getFeatureValues(feature) {
        const values = _.mapValues(this.data,
            (features, project) => this.getFeatureValue(feature, features[feature], project)
        );
        return _.sortBy(values, value => value);
    }

    // Returns the score for a feature, which is relative to either the lead
    // or the mean value of the feature and is at most 100%
    getFeatureScore(feature, project=null) {
        if (this.mode === 'rank') {
            return _.findIndex(this.getFeatureRanks(feature),
                value => (project === null ? value === this.project : value === project)
            ) + 1;
        }

        const value = this.getFeatureValue(feature, null, project);

        if (this.mode === 'mean') {
            return this.roundValue(value, this.getMeanValue(feature), true);
        }

        return this.roundValue(value, this.getLeadValue(feature), true);
    }

    // Returns the total score for the current group. This is the average of
    // all other scores, and depends on the mode (lead or mean)
    getTotalScore() {
        let totalFeatures = 0;
        let totalScore = 0;

        _.forEach(this.cards, card => {
            totalFeatures += 1;
            totalScore += this.getFeatureScore(card.feature, card.project);
        });

        const value = this.roundValue(totalScore, totalFeatures);
        return this.mode === 'rank' ? Math.round(value) : value;
    }

    // Returns a string indicating how good the given score is
    getScoreClass(score) {
        if (this.mode === 'rank') {
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
    }

    getScoreText(score) {
        return this.mode === 'rank' ? `#${score}` : `${score}%`;
    }

    // Get the HTML content for a score element
    getScoreHtml(card) {
        const score = this.getFeatureScore(card.feature, card.project);
        const scoreClass = this.getScoreClass(score);
        const text = this.getScoreText(score);

        return `<span class="score-${scoreClass}">${text}</span>`;
    }
}

class CardLocale {
    constructor(locales, localization, normalize) {
        this.locales = locales;
        this.localization = localization;
        this.normalize = normalize;
    }

    getFeatureName(feature) {
        return this.locales.retrieve(this.localization.descriptions, feature);
    }

    getNormalize(feature) {
        return this.normalize[feature] || null;
    }
}

class Card {
    constructor(feature, project, value, locale) {
        this.feature = feature;
        this.project = project;
        this.value = value;
        this.locale = locale;

        // For drag and drop
        this.x = 0;
        this.y = 0;
    }

    // Returns the card title for a feature, which is potentially being
    // normalized by another feature.
    getCardTitle() {
        const name = this.locale.getFeatureName(this.feature);
        const normalize = this.locale.getNormalize(this.feature);
        if (normalize === null) {
            return `<span class="card-title" tabindex="0">${name}</span>`;
        }

        return `<span class="card-title" tabindex="0">${name}</span>
            <span class="break">&nbsp;/&nbsp;</span>
            <span class="card-normalize" tabindex="0">${this.locale.getFeatureName(normalize)}</span>`;
    }

    getFeatureTitle() {
        const name = this.locale.getFeatureName(this.feature);
        const normalize = this.locale.getNormalize(this.feature);
        if (normalize === null) {
            return name;
        }

        return `${name} / ${this.locale.getFeatureName(normalize)}`;
    }

    getRawValue() {
        return this.value;
    }

    getNormalize() {
        return this.locale.getNormalize(this.feature);
    }
}

export { CardGroup, CardLocale };
