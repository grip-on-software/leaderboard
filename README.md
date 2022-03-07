# Leaderboard

This visualization produces project statistics as a leaderboard, similar to 
GitLab's [DevOps 
Score](https://docs.gitlab.com/ee/user/admin_area/analytics/dev_ops_report.html), 
previously known as Conversational Development Index.

## Configuration

Copy the file `lib/config.json` to `config.json` and adjust environmental 
settings in that file. The following configuration items are known:

- `visualization_url`: The URL to the visualization hub. This may include 
  a protocol and domain name, but does not need to in case all the 
  visualizations and the leaderboard are hosted on the same domain (for example 
  in a development environment). The remainder is a path to the root of the 
  visualizations, where the dashboard is found and every other visualization 
  has sub-paths below it.
- `path`: The relative path at which the leaderboard is made available on the 
  server. This can remain the default `.` to work just fine.

## Data

The data for the sprint report can be analyzed and output through runs of 
scripts from the `data-analysis` repository upon a collection of Scrum data in 
a Grip on Software database. The `features.r` script in that repository has 
options to export the project data in the JSON format that is expected by the 
leaderboard (for an example, see the `Collect` step in the `Jenkinsfile`).
The entire data collection must be placed in the `public/data` directory.

## Running

The visualization can be built using Node.js and `npm` by running `npm install` 
and then either `npm run watch` to start a development server that also 
refreshes browsers upon code changes, or `npm run production` to create 
a minimized bundle. The resulting HTML, CSS and JavaScript is made available in 
the `public` directory.

This repository also contains a `Dockerfile` specification for a Docker image 
that can performs the installation of the app and dependencies, which allows 
building the visualization within there. The `Jenkinsfile` contains appropriate 
steps for a Jenkins CI deployment, including data collection and visualization 
building.
