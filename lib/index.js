import * as d3 from 'd3';
import axios from 'axios';
import spinner from './spinner';

const loadingSpinner = new spinner({
    width: d3.select('#container').node().clientWidth,
    height: 100,
    startAngle: 220,
    container: '#container',
    id: 'loading-spinner'
});
loadingSpinner.start();

// Use a local file by default
let projectFeaturesUrl = 'data/project_features.json';
let localizationUrl = 'localization.json';

axios.all([axios.get(projectFeaturesUrl), axios.get(localizationUrl)])
    .then(axios.spread(function (leaderboardData, localization) {
        let data = leaderboardData.data;
        console.log(data);

        // Application logic...

        d3.select('#overview').style('display', 'block');

        loadingSpinner.stop();
    }))
    .catch(function (error) {
        console.log(error);
        loadingSpinner.stop();
        d3.select('#error-message')
            .style('display', 'block')
            .text('Could not load data: ' + error);
    });
