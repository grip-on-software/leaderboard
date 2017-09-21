// Author: Mike Bostock
// Source: https://bl.ocks.org/mbostock/4061502
// License: GNU General Public License, version 3
// Updated for d3 version 4, webpack and leaderboard usage

import * as d3 from 'd3';

// Inspired by http://informationandvisualization.de/blog/box-plot
const box = function() {
  var width = 1,
      height = 1,
      duration = 0,
      domain = null,
      value = Number,
      whiskers = boxWhiskers,
      quartiles = boxQuartiles,
      boxRatio = 1/1.5,
      horizontal = false,
      tickFormat = null;

  function box(g, highlight) {
    g.each(function(d, i) {
      d = d.map(value).sort(d3.ascending);
      var g = d3.select(this),
          n = d.length,
          min = d[0],
          max = d[n - 1];

      // Compute quartiles. Must return exactly 3 elements.
      var quartileData = d.quartiles = quartiles(d);

      // Compute whiskers. Must return exactly 2 elements, or null.
      var whiskerIndices = whiskers && whiskers.call(this, d, i),
          whiskerData = whiskerIndices && whiskerIndices.map(function(i) { return d[i]; });

      // Compute outliers. If no whiskers are specified, all data are "outliers".
      // We compute the outliers as indices, so that we can join across transitions!
      var outlierIndices = whiskerIndices
          ? d3.range(0, whiskerIndices[0]).concat(d3.range(whiskerIndices[1] + 1, n))
          : d3.range(n);

      // Compute the new x-scale.
      var x1 = d3.scaleLinear()
          .domain(domain && domain.call(this, d, i) || [min, max])
          .range(horizontal ? [0, width] : [height, 0]);

      // Retrieve the old x-scale, if this is an update.
      var x0 = this.__chart__ || d3.scaleLinear()
          .domain([0, Infinity])
          .range(x1.range());

      // Stash the new scale.
      this.__chart__ = x1;

      // Note: the box, median, and box tick elements are fixed in number,
      // so we only have to handle enter and update. In contrast, the outliers
      // and other elements are variable, so we need to exit them! Variable
      // elements also fade in and out.

      // Update center line: the vertical line spanning the whiskers.
      var center = g.selectAll("line.center")
          .data(whiskerData ? [whiskerData] : []);

      const xAttr = horizontal ? "y" : "x",
            yAttr = horizontal ? "x" : "y",
            widthAttr = horizontal ? "height" : "width",
            heightAttr = horizontal ? "width" : "height",
            boxExtent = horizontal ? height : width;

      center.enter().insert("line", "rect")
          .attr("class", "center")
          .attr(xAttr + "1", boxExtent / 2)
          .attr(yAttr + "1", function(d) { return x0(d[0]); })
          .attr(xAttr + "2", boxExtent / 2)
          .attr(yAttr + "2", function(d) { return x0(d[1]); })
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .style("opacity", 1)
          .attr(yAttr + "1", function(d) { return x1(d[0]); })
          .attr(yAttr + "2", function(d) { return x1(d[1]); });

      center.transition()
          .duration(duration)
          .style("opacity", 1)
          .attr(yAttr + "1", function(d) { return x1(d[0]); })
          .attr(yAttr + "2", function(d) { return x1(d[1]); });

      center.exit().transition()
          .duration(duration)
          .style("opacity", 1e-6)
          .attr(yAttr + "1", function(d) { return x1(d[0]); })
          .attr(yAttr + "2", function(d) { return x1(d[1]); })
          .remove();

      // Update innerquartile box.
      var box = g.selectAll("rect.plot-box")
          .data([quartileData]);

      const boxStart = (boxExtent * (1 - boxRatio)) / 2,
            start = d => horizontal ? d[0] : d[2],
            end = d => horizontal ? d[2] : d[0];
      box.enter().append("rect")
          .attr("class", "plot-box")
          .attr(xAttr, boxStart) 
          .attr(yAttr, d => x0(start(d)))
          .attr(widthAttr, boxExtent * boxRatio)
          .attr(heightAttr, d => x0(end(d)) - x0(start(d)))
        .transition()
          .duration(duration)
          .attr(yAttr, d => x1(start(d)))
          .attr(heightAttr, d => x1(end(d)) - x1(start(d)));

      box.transition()
          .duration(duration)
          .attr(yAttr, d => x1(start(d)))
          .attr(heightAttr, d => x1(end(d)) - x1(start(d)));

      // Update median line.
      var medianLine = g.selectAll("line.median")
          .data([quartileData[1]]);

      medianLine.enter().append("line")
          .attr("class", "median")
          .attr(xAttr + "1", boxStart)
          .attr(yAttr + "1", x0)
          .attr(xAttr + "2", boxExtent - boxStart)
          .attr(yAttr + "2", x0)
        .transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1);

      medianLine.transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1);

      // Update whiskers.
      var whisker = g.selectAll("line.whisker")
          .data(whiskerData || []);

      whisker.enter().insert("line", "circle, text")
          .attr("class", "whisker")
          .attr(xAttr + "1", 0)
          .attr(yAttr + "1", x0)
          .attr(xAttr + "2", boxExtent)
          .attr(yAttr + "2", x0)
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1)
          .style("opacity", 1);

      whisker.transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1)
          .style("opacity", 1);

      whisker.exit().transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1)
          .style("opacity", 1e-6)
          .remove();

      // Update outliers.
      var outlier = g.selectAll("circle.outlier")
          .data(outlierIndices, Number);

      outlier.enter().insert("circle", "text")
          .attr("class", "outlier")
          .attr("r", 2)
          .attr("c" + xAttr, boxExtent / 2)
          .attr("c" + yAttr, function(i) { return x0(d[i]); })
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .attr("c" + yAttr, function(i) { return x1(d[i]); })
          .style("opacity", 1);

      outlier.transition()
          .duration(duration)
          .attr("c" + yAttr, function(i) { return x1(d[i]); })
          .style("opacity", 1);

      outlier.exit().transition()
          .duration(duration)
          .attr("c" + yAttr, function(i) { return x1(d[i]); })
          .style("opacity", 1e-6)
          .remove();

      // Update highlight line.
      var highlightLine = g.selectAll("line.highlight")
          .data([highlight]);

      highlightLine.enter().append("line")
          .attr("class", "highlight")
          .attr(xAttr + "1", 0)
          .attr(yAttr + "1", x0)
          .attr(xAttr + "2", boxExtent)
          .attr(yAttr + "2", x0)
        .transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1);

      highlightLine.transition()
          .duration(duration)
          .attr(yAttr + "1", x1)
          .attr(yAttr + "2", x1);

      // Compute the tick format.
      var format = tickFormat || x1.tickFormat(8);

      // Update box ticks.
      var boxTick = g.selectAll("text.box")
          .data(quartileData);

      boxTick.enter().append("text")
          .attr("class", "box")
          .attr("d" + yAttr, ".3em")
          .attr("d" + xAttr, function(d, i) { return i & 1 ? 6 : -6 })
          .attr(xAttr, function(d, i) { return i & 1 ? boxExtent : 0 })
          .attr(yAttr, x0)
          .attr("text-anchor", function(d, i) { return i & 1 ? "start" : "end"; })
          .text(format)
        .transition()
          .duration(duration)
          .attr(yAttr, x1);

      boxTick.transition()
          .duration(duration)
          .text(format)
          .attr(yAttr, x1);

      // Update whisker ticks. These are handled separately from the box
      // ticks because they may or may not exist, and we want don't want
      // to join box ticks pre-transition with whisker ticks post-.
      var whiskerTick = g.selectAll("text.whisker")
          .data(whiskerData || []);

      whiskerTick.enter().append("text")
          .attr("class", "whisker")
          .attr("d" + yAttr, ".3em")
          .attr("d" + xAttr, 6)
          .attr(xAttr, boxExtent)
          .attr(yAttr, x0)
          .text(format)
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .attr(yAttr, x1)
          .style("opacity", 1);

      whiskerTick.transition()
          .duration(duration)
          .text(format)
          .attr(yAttr, x1)
          .style("opacity", 1);

      whiskerTick.exit().transition()
          .duration(duration)
          .attr(yAttr, x1)
          .style("opacity", 1e-6)
          .remove();
    });
    d3.timerFlush();
  }

  box.width = function(x) {
    if (!arguments.length) return width;
    width = x;
    return box;
  };

  box.height = function(x) {
    if (!arguments.length) return height;
    height = x;
    return box;
  };

  box.tickFormat = function(x) {
    if (!arguments.length) return tickFormat;
    tickFormat = x;
    return box;
  };

  box.duration = function(x) {
    if (!arguments.length) return duration;
    duration = x;
    return box;
  };

  box.domain = function(x) {
    if (!arguments.length) return domain;
    domain = x === null ? x :
        (typeof x === "function" ? x : () => x);
    return box;
  };

  box.value = function(x) {
    if (!arguments.length) return value;
    value = x;
    return box;
  };

  box.whiskers = function(x) {
    if (!arguments.length) return whiskers;
    whiskers = x;
    return box;
  };

  box.quartiles = function(x) {
    if (!arguments.length) return quartiles;
    quartiles = x;
    return box;
  };

  box.ratio = function(x) {
    if (!arguments.length) return boxRatio;
    boxRatio = x;
    return box;
  };

  box.horizontal = function(x) {
    if (!arguments.length) return horizontal;
    horizontal = x;
    return box;
  };

  return box;
};

function boxWhiskers(d) {
  return [0, d.length - 1];
}

function boxQuartiles(d) {
  return [
    d3.quantile(d, .25),
    d3.quantile(d, .5),
    d3.quantile(d, .75)
  ];
}

export default box
