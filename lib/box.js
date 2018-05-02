// Author: Mike Bostock
// Source: https://bl.ocks.org/mbostock/4061502
// License: GNU General Public License, version 3
// Updated for d3 version 4, webpack and leaderboard usage
// Inspired by http://informationandvisualization.de/blog/box-plot

import * as d3 from 'd3';

function boxWhiskers(d) {
    return [0, d.length - 1];
}

function boxQuartiles(d) {
    return [
        d3.quantile(d, 0.25),
        d3.quantile(d, 0.5),
        d3.quantile(d, 0.75)
    ];
}

class box {
    constructor() {
        this.options = {
            width: 1,
            height: 1,
            duration: 0,
            domain: null,
            value: Number,
            whiskers: boxWhiskers,
            quartiles: boxQuartiles,
            ratio: 1/1.5,
            horizontal: false,
            tickFormat: null
        };
        this.attrs = {
            "x": "x",
            "y": "y",
            "width": "width",
            "height": "height",
            "extent": this.options.width,
        };
        this.x1 = null;
        this.x0 = null;
    }

    build(g, highlight) {
        const box = this;
        g.each(function(d, i) {
            box.buildBox(d3.select(this), d, i, highlight);
        });
    }

    buildBox(g, d, i, highlight) {
        d = d.map(this.options.value).sort(d3.ascending);
        var n = d.length,
            min = d[0],
            max = d[n - 1];

        // Compute quartiles. Must return exactly 3 elements.
        var quartileData = d.quartiles = this.options.quartiles(d);

        // Compute whiskers. Must return exactly 2 elements, or null.
        var whiskerIndices = this.options.whiskers && this.options.whiskers.call(g, d, i),
            whiskerData = whiskerIndices && whiskerIndices.map(i => d[i]);

        // Compute outliers. If no whiskers are specified, all data are "outliers".
        // We compute the outliers as indices, so that we can join across transitions!
        var outlierIndices = whiskerIndices ?
            d3.range(0, whiskerIndices[0]).concat(d3.range(whiskerIndices[1] + 1, n)) :
            d3.range(n);

        // Compute the new x-scale.
        this.x1 = d3.scaleLinear()
            .domain(this.options.domain && this.options.domain.call(g, d, i) || [min, max])
            .range(this.options.horizontal ?
                [0, this.options.width] : [this.options.height, 0]
            );

        // Retrieve the old x-scale, if this is an update.
        this.x0 = this.x0 || d3.scaleLinear()
            .domain([0, Infinity])
            .range(this.x1.range());

        this.update(g, d, highlight, quartileData, whiskerData, outlierIndices);
    }

    update(g, d, highlight, quartileData, whiskerData, outlierIndices) {
        this.attrs.x = this.horizontal ? "y" : "x";
        this.attrs.y = this.horizontal ? "x" : "y";
        this.attrs.width = this.horizontal ? "height" : "width";
        this.attrs.height = this.horizontal ? "width" : "height";
        this.attrs.extent = this.horizontal ? this.options.height : this.options.width;

        this.updateCenter(g.selectAll("line.center")
            .data(whiskerData ? [whiskerData] : []));
        this.updateQuartile(g.selectAll("rect.plot-box")
            .data([quartileData]));
        this.updateMedian(g.selectAll("line.median")
            .data([quartileData[1]]));
        this.updateWhiskers(g.selectAll("line.whisker")
            .data(whiskerData || []));
        this.updateOutliers(g.selectAll("circle.outlier")
            .data(outlierIndices, Number), d);
        this.updateHighlight(g.selectAll("line.highlight")
            .data([highlight]));
        this.updateBoxTicks(g.selectAll("text.box")
            .data(quartileData));
        this.updateWhiskerTicks(g.selectAll("text.whisker")
            .data(whiskerData || []));

        d3.timerFlush();
    }

    // Note: the box, median, and box tick elements are fixed in number,
    // so we only have to handle enter and update. In contrast, the outliers
    // and other elements are variable, so we need to exit them! Variable
    // elements also fade in and out.

    updateCenter(center) {
        // Update center line: the vertical line spanning the whiskers.
        center.enter().insert("line", "rect")
            .attr("class", "center")
            .attr(this.attrs.x + "1", this.attrs.extent / 2)
            .attr(this.attrs.y + "1", d => this.x0(d[0]))
            .attr(this.attrs.x + "2", this.attrs.extent / 2)
            .attr(this.attrs.y + "2", d => this.x0(d[1]))
            .style("opacity", 1e-6)
            .transition()
            .duration(this.options.duration)
            .style("opacity", 1)
            .attr(this.attrs.y + "1", d => this.x1(d[0]))
            .attr(this.attrs.y + "2", d => this.x1(d[1]));

        center.transition()
            .duration(this.options.duration)
            .style("opacity", 1)
            .attr(this.attrs.y + "1", d => this.x1(d[0]))
            .attr(this.attrs.y + "2", d => this.x1(d[1]));

        center.exit().transition()
            .duration(this.options.duration)
            .style("opacity", 1e-6)
            .attr(this.attrs.y + "1", d => this.x1(d[0]))
            .attr(this.attrs.y + "2", d => this.x1(d[1]))
            .remove();
    }

    updateQuartile(box) {
        // Update innerquartile box.
        const boxStart = (this.attrs.extent * (1 - this.options.ratio)) / 2,
            start = d => this.horizontal ? d[0] : d[2],
            end = d => this.horizontal ? d[2] : d[0];
        box.enter().append("rect")
            .attr("class", "plot-box")
            .attr(this.attrs.x, boxStart)
            .attr(this.attrs.y, d => this.x0(start(d)))
            .attr(this.attrs.width, this.attrs.extent * this.options.ratio)
            .attr(this.attrs.height, d => this.x0(end(d)) - this.x0(start(d)))
            .transition()
            .duration(this.options.duration)
            .attr(this.attrs.y, d => this.x1(start(d)))
            .attr(this.attrs.height, d => this.x1(end(d)) - this.x1(start(d)));

        box.transition()
            .duration(this.options.duration)
            .attr(this.attrs.y, d => this.x1(start(d)))
            .attr(this.attrs.height, d => this.x1(end(d)) - this.x1(start(d)));
    }

    updateMedian(medianLine) {
        // Update median line.
        const boxStart = (this.attrs.extent * (1 - this.options.ratio)) / 2;

        medianLine.enter().append("line")
            .attr("class", "median")
            .attr(this.attrs.x + "1", boxStart)
            .attr(this.attrs.y + "1", this.x0)
            .attr(this.attrs.x + "2", this.attrs.extent - boxStart)
            .attr(this.attrs.y + "2", this.x0)
            .transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1);

        medianLine.transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1);
    }

    updateWhiskers(whisker) {
        // Update whiskers.
        whisker.enter().insert("line", "circle, text")
            .attr("class", "whisker")
            .attr(this.attrs.x + "1", 0)
            .attr(this.attrs.y + "1", this.x0)
            .attr(this.attrs.x + "2", this.attrs.extent)
            .attr(this.attrs.y + "2", this.x0)
            .style("opacity", 1e-6)
            .transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1)
            .style("opacity", 1);

        whisker.transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1)
            .style("opacity", 1);

        whisker.exit().transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1)
            .style("opacity", 1e-6)
            .remove();
    }

    updateOutliers(outlier, d) {
        // Update outliers.
        outlier.enter().insert("circle", "text")
            .attr("class", "outlier")
            .attr("r", 2)
            .attr("c" + this.attrs.x, this.attrs.extent / 2)
            .attr("c" + this.attrs.y, i => this.x0(d[i]))
            .style("opacity", 1e-6)
            .transition()
            .duration(this.options.duration)
            .attr("c" + this.attrs.y, i => this.x1(d[i]))
            .style("opacity", 1);

        outlier.transition()
            .duration(this.options.duration)
            .attr("c" + this.attrs.y, i => this.x1(d[i]))
            .style("opacity", 1);

        outlier.exit().transition()
            .duration(this.options.duration)
            .attr("c" + this.attrs.y, i => this.x1(d[i]))
            .style("opacity", 1e-6)
            .remove();
    }

    updateHighlight(highlightLine) {
        // Update highlight line.
        highlightLine.enter().append("line")
            .attr("class", "highlight")
            .attr(this.attrs.x + "1", 0)
            .attr(this.attrs.y + "1", this.x0)
            .attr(this.attrs.x + "2", this.attrs.extent)
            .attr(this.attrs.y + "2", this.x0)
            .transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1);

        highlightLine.transition()
            .duration(this.options.duration)
            .attr(this.attrs.y + "1", this.x1)
            .attr(this.attrs.y + "2", this.x1);
    }

    updateBoxTicks(boxTick) {
        // Compute the tick format.
        const format = this.options.tickFormat || this.x1.tickFormat(8);

        // Update box ticks.
        boxTick.enter().append("text")
            .attr("class", "box")
            .attr("d" + this.attrs.y, ".3em")
            .attr("d" + this.attrs.x, (d, i) => i & 1 ? 6 : -6)
            .attr(this.attrs.x, (d, i) => i & 1 ? this.attrs.extent : 0)
            .attr(this.attrs.y, this.x0)
            .attr("text-anchor", (d, i) => i & 1 ? "start" : "end")
            .text(format)
            .transition()
            .duration(this.options.duration)
            .attr(this.attrs.y, this.x1);

        boxTick.transition()
            .duration(this.options.duration)
            .text(format)
            .attr(this.attrs.y, this.x1);
    }

    updateWhiskerTicks(whiskerTick) {
        // Update whisker ticks. These are handled separately from the box
        // ticks because they may or may not exist, and we want don't want
        // to join box ticks pre-transition with whisker ticks post-.

        // Compute the tick format.
        const format = this.options.tickFormat || this.x1.tickFormat(8);

        whiskerTick.enter().append("text")
            .attr("class", "whisker")
            .attr("d" + this.attrs.y, ".3em")
            .attr("d" + this.attrs.x, 6)
            .attr(this.attrs.x, this.attrs.extent)
            .attr(this.attrs.y, this.x0)
            .text(format)
            .style("opacity", 1e-6)
            .transition()
            .duration(this.options.duration)
            .attr(this.attrs.y, this.x1)
            .style("opacity", 1);

        whiskerTick.transition()
            .duration(this.options.duration)
            .text(format)
            .attr(this.attrs.y, this.x1)
            .style("opacity", 1);

        whiskerTick.exit().transition()
            .duration(this.options.duration)
            .attr(this.attrs.y, this.x1)
            .style("opacity", 1e-6)
            .remove();
    }

    width(x) {
        if (!arguments.length) {
            return this.options.width;
        }
        this.options.width = x;
        return this;
    }

    height(x) {
        if (!arguments.length) {
            return this.options.height;
        }
        this.options.height = x;
        return this;
    }

    tickFormat(x) {
        if (!arguments.length) {
            return this.options.tickFormat;
        }
        this.options.tickFormat = x;
        return this;
    }

    duration(x) {
        if (!arguments.length) {
            return this.options.duration;
        }
        this.options.duration = x;
        return this;
    }

    domain(x) {
        if (!arguments.length) {
            return this.options.domain;
        }
        if (x === null) {
            this.options.domain = null;
        }
        else {
            this.options.domain = (typeof x === "function" ? x : () => x);
        }
        return this;
    }

    value(x) {
        if (!arguments.length) {
            return this.options.value;
        }
        this.options.value = x;
        return this;
    }

    whiskers(x) {
        if (!arguments.length) {
            return this.options.whiskers;
        }
        this.options.whiskers = x;
        return this;
    }

    quartiles(x) {
        if (!arguments.length) {
            return this.options.quartiles;
        }
        this.options.quartiles = x;
        return this;
    }

    ratio(x) {
        if (!arguments.length) {
            return this.options.ratio;
        }
        this.options.ratio = x;
        return this;
    }

    horizontal(x) {
        if (!arguments.length) {
            return this.options.horizontal;
        }
        this.options.horizontal = x;
        return this;
    }
}

export default box;
