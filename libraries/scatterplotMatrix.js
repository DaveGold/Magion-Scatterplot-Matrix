/**
 *  Scatterplot Matrix
 *
 *  Copyright 2017, by David Golverdingen
 *  Copyright 2016, by Mike Bostock
 *
 *  Licensed under GNU General Public License 3.0 or later. 
 *  Some rights reserved. See COPYING, AUTHORS.
 *
 * @license GNU 3 https://opensource.org/licenses/GPL-3.0
 * 
 * Modifications 2017: 
 * Added external arguments and removed csv read function
 * Added automatic scaling based on external width
 * Upgraded to d3v4
 * Added pearson correlation
 * Added spearman correlation
 * Added linear regression
 * Renamed variables and function to more generic names
 * Added outliers filter Mahalanobis 
 * Added color to pairs 
 * Moved css styling to javascript
 * 
 * Dependencies:
 *  jStat.js
 *  mahalanobis.js
 *  d3v4.js
 *  lodash.js
 * 
 */

// Create d3 scatterplot matrix
//
// data = { plotData : [[1,2],[2,5]], plotNames : ["x","y"], plotPaths : ["sourcePathX","sourcePathY"] }
// id = html id target
// options = overrule cfg object
//
function createScatterMatrix(data, id, options) {

    console.log(data);

    // default config
    var cfg = {
        Width: 700,
        Height: 700,
        RemoveOutliers: false,
        FilterMultiplier: 1.5,
        ShowBasicStatistics: false,
        ShowRegression: false,
        ShowPearson: false,
        ShowSpearman: false
    };

    // override default config
    if ("undefined" !== typeof options) {
        for (var i in options) {
            if ("undefined" !== typeof options[i]) {
                cfg[i] = options[i];
            }
        }
    }

    $("#" + id).empty();

    var n = data.plotNames.length;

    var width = cfg.Width - 20,
        padding = 20,
        size = (width - (2 * padding)) / n;

    var x = d3.scaleLinear()
        .range([padding / 2, size - padding / 2]);
    var y = d3.scaleLinear()
        .range([size - padding / 2, padding / 2]);
    var xAxis = d3.axisBottom(x)
        .ticks(4);
    var yAxis = d3.axisLeft(y)
        .ticks(4);

    var color = d3.scaleOrdinal(d3.schemeCategory20);

    var domainByPoint = {};
    for (var i = 0; i < n; i++) {
        domainByPoint[i] = d3.extent(data.plotData, function (d) { return d[i]; });
    }

    xAxis.tickSize(size * n);
    yAxis.tickSize(-size * n);

    // Create svg
    var svg = d3.select("#" + id)
        .append("svg")
        .attr("width", size * n + padding)
        .attr("height", size * n + padding)
        .append("g")
        .attr("transform", "translate(" + padding + "," + padding / 2 + ")")
        .style("font", "10px sans-serif")

    // Create x axis
    svg.selectAll(".x.axis")
        .data(data.plotNames)
        .enter()
        .append("g")
        .attr("class", "x axis")
        .attr("transform", function (d, i) { return "translate(" + (n - i - 1) * size + ",0)"; })
        .each(function (d, i) {
            x.domain(domainByPoint[i]);
            d3.select(this).call(xAxis);
        });

    // Create y axis
    svg.selectAll(".y.axis")
        .data(data.plotNames)
        .enter()
        .append("g")
        .attr("class", "y axis")
        .attr("transform", function (d, i) { return "translate(0," + i * size + ")"; })
        .each(function (d, i) {
            y.domain(domainByPoint[i]);
            d3.select(this).call(yAxis);
        })

    // Style svg
    d3.select("#"+id + " svg").style("padding","10px")

    // Style axis path
    svg.selectAll(".axis path")
        .style("display", "none")

    // Style all lines
    svg.selectAll(".tick line")
        .style("stroke", "black")
        .style("shape-rendering", "crispEdges");

    // Style all axis values
    svg.selectAll(".tick text")
        .style("fill", "#fff");
   
    // Add data to all cells
    var cell = svg.selectAll(".cell")
        .data(cross(data.plotNames, data.plotNames))
        .enter()
        .append("g")
        .attr("class", "cell")
        .attr("transform", function (d) { return "translate(" + (n - d.i - 1) * size + "," + d.j * size + ")"; })
        .each(plot);

    // Plot data in matrix position
    function plot(p) {
        var cell = d3.select(this);
        var format = d3.format(".3")

        x.domain(domainByPoint[p.i]);
        y.domain(domainByPoint[p.j]);

        // Prep data format
        var arrayXY = [
            _.map(data.plotData, function (value) { return value[p.i]; }),
            _.map(data.plotData, function (value) { return value[p.j]; })
        ];
        var zippedArrayXY = _.zip(arrayXY[0], arrayXY[1]);

        // Filter Outliers and override xy data
        if (p.i !== p.j && cfg.RemoveOutliers) {
            var distances = mahalanobis(zippedArrayXY);
            // multiplier between 1 - 2, flip values so that 2 becomes strong and 1 weak
            var criticalValue = _.mean(distances) * (3-cfg.FilterMultiplier);
            zippedArrayXY = _.filter(zippedArrayXY, function (row, i) {
                return distances[i] <= criticalValue;
            });
            arrayXY = [
            _.map(zippedArrayXY, function (value) { return value[0]; }),
            _.map(zippedArrayXY, function (value) { return value[1]; })
            ];
        }

        // Draw frame
        cell.append("rect")
            .attr("class", "frame")
            .attr("x", padding / 2)
            .attr("y", padding / 2)
            .attr("width", size - padding)
            .attr("height", size - padding)
            .style("stroke","#aaa")
            .style("fill", "none")
            .style("shape-rendering", "crispEdges");

        // Plot data, Correlation and regression for cells without domain text and data
        if (p.i !== p.j) {

            // Plot circles
            cell.selectAll("circle")
            .data(zippedArrayXY)
            .enter()
            .append("circle")
            .attr("cx",
                function (d) {
                    return x(d[0]);
                })
            .attr("cy",
                function (d) {
                    return y(d[1]);
                })
            .attr("r", 4)
            .style("fill",
                function (d) {
                    return color((p.i + 1) * (p.j + 1));
                })
            .style("fill-opacity", 0.7)
            .append("svg:title")
            .text(function (d, i) {
                return p.x + " : " + format(d[0]) + "\n" + p.y + " : " + format(d[1]);
            });

            // Calculate correlation
            var correlationPearson = format(jStat.corrcoeff(arrayXY[0], arrayXY[1]));
            var correlationSpearman = format(jStat.spearmancoeff(arrayXY[0], arrayXY[1]));
            if (cfg.ShowPearson && !cfg.ShowSpearman) {
                cell.append("text")
                    .attr("x", padding)
                    .attr("y", padding)
                    .attr("dy", "1em")
                    .text("\u03B3 : " + correlationPearson)
                    .style("fill", "#fff");
            }
            if (cfg.ShowSpearman && !cfg.ShowPearson) {
                cell.append("text")
                    .attr("x", padding)
                    .attr("y", padding)
                    .attr("dy", "1em")
                    .text("\u03C1 : " + correlationSpearman)
                    .style("fill", "#fff");
            }
            if (cfg.ShowSpearman && cfg.ShowPearson) {
                cell.append("text")
                    .attr("x", padding)
                    .attr("y", padding)
                    .attr("dy", "1em")
                    .text("\u03B3 : " + correlationPearson)
                    .style("fill", "#fff");
                cell.append("text")
                    .attr("x", padding)
                    .attr("y", padding * 1.8)
                    .attr("dy", "1em")
                    .text("\u03C1 : " + correlationSpearman)
                    .style("fill", "#fff");
            }

            if (cfg.ShowRegression) {
                // Calculate Regression
                var lr = linearRegression(arrayXY[1], arrayXY[0]);
                
                // Get y for x domain
                var xmin = x.domain()[0];
                var ymin = lr.fnx(xmin)
                // check y is ok
                if (ymin < y.domain()[0]) {
                    xmin = lr.fny(y.domain()[0]);
                    ymin = y.domain()[0];
                }
                if (ymin > y.domain()[1]) {
                    xmin = lr.fny(y.domain()[1]);
                    ymin = y.domain()[1];
                }
                var xmax = x.domain()[1];
                var ymax = lr.fnx(xmax)
                // check y is ok
                if (ymax < y.domain()[0]) {
                    xmax = lr.fny(y.domain()[0]);
                    ymax = y.domain()[0];
                }
                if (ymax > y.domain()[1]) {
                    xmax = lr.fny(y.domain()[1]);
                    ymax = y.domain()[1];
                }

                if (!isNaN(xmin) && !isNaN(xmax) && !isNaN(ymin) & !isNaN(ymax)) {
                    // Regression line for cell without domain text
                    cell.append("svg:line")
                        .attr("x1", x(xmin))
                        .attr("y1", y(ymin))
                        .attr("x2", x(xmax))
                        .attr("y2", y(ymax))
                        .style("stroke-width", 2)
                        .style("stroke", "white")
                        .append("svg:title")
                        .text(function () {
                            if (lr.intercept >= 0) {
                                return "f(x) = " + format(lr.slope) + "x+" + format(lr.intercept);
                            } else {
                                return "f(x) = " + format(lr.slope) + "x" + format(lr.intercept);
                            }

                        });
                }
            }
        }
        // Domain text and basic statistics for domain cells
        else {
            // Domain text for tiles on the diagonal.
            cell.append("text")
                .attr("x", padding)
                .attr("y", padding)
                .attr("dy", "1em")
                .text(p.x)
                .style("font-weight", "bold")
                .style("text-transform", "capitalize")
                .style("fill", "#fff")
                .style("font-size", 12)
                .append("svg:title")
                .text(data.plotPaths[p.i]);


            if (cfg.ShowBasicStatistics) {
                // Calculate basic statistics

                var array = arrayXY[0];
                var stats = [
                    { name: "Mean", value: jStat.mean(array) },
                    { name: "Median", value: jStat.median(array) },
                    { name: "Range", value: jStat.range(array) },
                    { name: "Standard Deviation", value: jStat.stdev(array) },
                    { name: "Variance", value: jStat.variance(array) },
                    { name: "Skewness", value: jStat.skewness(array) },
                    { name: "Kurtosis", value: jStat.kurtosis(array) }
                ];

                stats.forEach(function(data, index) {
                    cell.append("text")
                        .attr("x", padding)
                        .attr("y",
                            function() {
                                return padding * 0.6 * (index + 1);
                            })
                        .attr("dy", "3.5em")
                        .text(data.name + " : " + format(data.value))
                        .style("fill", "#fff");
                })
            }
            else {
                // Plot circles
                cell.selectAll("circle")
                .data(zippedArrayXY)
                .enter()
                .append("circle")
                .attr("cx",
                    function (d) {
                        return x(d[0]);
                    })
                .attr("cy",
                    function (d) {
                        return y(d[1]);
                    })
                .attr("r", 4)
                .style("fill", "#fff")
                .style("fill-opacity", 0.7)
                .append("svg:title")
                .text(function (d, i) {
                    return p.x + " : " + format(d[0]) + "\n" + p.y + " : " + format(d[1]);
                });
            }

        }
    };

    // Calculate positions
    function cross(a, b) {
        var c = [], n = a.length, m = b.length, i, j;
        for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({ x: a[i], i: i, y: b[j], j: j });
        return c;
    };

    // Calculate linear regression
    function linearRegression(y, x) {
        var lr = {};
        var n = y.length;
        var sum_x = 0;
        var sum_y = 0;
        var sum_xy = 0;
        var sum_xx = 0;
        var sum_yy = 0;

        for (var i = 0; i < y.length; i++) {
            sum_x += x[i];
            sum_y += y[i];
            sum_xy += (x[i] * y[i]);
            sum_xx += (x[i] * x[i]);
            sum_yy += (y[i] * y[i]);
        }

        lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
        lr['intercept'] = (sum_y - lr.slope * sum_x) / n;
        lr['r2'] = Math.pow((n * sum_xy - sum_x * sum_y) / Math.sqrt((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)), 2);
        lr['fnx'] = function (x) { return this.slope * x + this.intercept; };
        lr['fny'] = function (y) { return (y - this.intercept) / this.slope };

        return lr;
    };

}

