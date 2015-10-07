/**
 * @module d3Chart
 */

//namesapce
if (typeof window === 'undefined') {
    this.d3Chart = this.d3Chart || {};
} else {
    window.d3Chart = window.d3Chart || {};
}

(function () {
    var throttle = function (type, name, obj) {
        var obj = obj || window;
        var running = false;
        var func = function () {
            if (running) {
                return;
            }
            running = true;
            requestAnimationFrame(function () {
                obj.dispatchEvent(new CustomEvent(name));
                running = false;
            });
        };
        obj.addEventListener(type, func);
    };

    /* init - you can init any event */
    throttle("resize", "optimizedResize");
})();

//TO-DO 1. seperate axis layer as seperate Object and provide API to control each axis property like lable tick position Units etc....
// 2. Provide Comment for why certain things has to be in initialize chart and few on render chart
// 3. Support for color column
// 4. Support for Size Column
(function () {

    // constructor:
    /**
     * @class Scatterplot
     * @config {Objaect} configuraiton object to set x, y, key columns, Interaction
     * @constructor
     */
    function Scatterplot(config) {

        /**
         * reference for all d3 created internals
         * @public
         * @property internal
         * @type Object
         * @default {}
         */
        this.internal = {};

        /**
         * @public
         * @property xScale
         * @type Function
         * @default undefined
         */
        this.internal.xScale;

        /**
         * @public
         * @property yScale
         * @type Function
         * @default undefined
         */
        this.internal.yScale;

        /**
         * @public
         * @property xAxis
         * @type Function
         * @default undefined
         */
        this.internal.xAxis;

        /**
         * @public
         * @property yAxis
         * @type Function
         * @default undefined
         */
        this.internal.yAxis;
        this.internal.xAxisLabel;
        this.internal.yAxisLabel;
        this.internal.xColumnType;
        this.internal.yColumnType;

        /**
         * @public
         * @property container
         * @type HTMLdivElement
         * @default undefined
         */
        this.internal.container;
        this.internal.svg;
        this.internal.chartGroup; // group inside the SVG
        this.internal.point;
        this.internal.brush;
        this.internal.kdRect;

        /**
         * function to generate quatree data
         * @public
         * @property quadTreeFactory
         * @type Function
         * @default undefined
         */
        this.internal.quadTreeFactory;
        this.internal.quadTree;

        if (config) {
            this.create(config);
            if (this.config.data.length > 0)
                this.renderChart(this.config.data);

        }

    }


    // setup x
    // data -> value
    function xValue(d, i) {
        var xCol = this.config.columns.x;
        if (typeof (d[xCol]) === "string") {
            if (isNaN(Number(d[xCol]))) {
                this.internal.xColumnType = "string";
                if (d.index === undefined) {
                    d.index = i;
                    return i;
                } else {
                    if (typeof (d.index) === "string")
                        d.index = Number(d.index);
                    return d.index;
                }
            } else {
                this.internal.xColumnType = "number";
                d[xCol] = Number(d[xCol]);
            }

        }
        return d[xCol];
    }

    // data -> display
    function xMap(d, i) {
        return this.internal.xScale(xValue.call(this, d, i));
    }

    // setup y
    // data -> value
    function yValue(d) {
        var yCol = this.config.columns.y;
        if (typeof (d[yCol]) === "string") {
            if (isNaN(Number(d[yCol]))) {
                this.internal.yColumnType = "string";
                if (d.index === undefined) {
                    d.index = i;
                    return i;
                } else {
                    if (typeof (d.index) === "string")
                        d.index = Number(d.index);
                    return d.index;
                }
            } else {
                this.internal.yColumnType = "number";
                d[yCol] = Number(d[yCol]);
            }
        }
        return d[yCol];
    }


    // data -> display
    function yMap(d, i) {
        return this.internal.yScale(yValue.call(this, d, i));
    }

    // setup fill color
    function cValue(d) {
        return d[this.config.columns.color];
    }

    // Find the nodes within the specified rectangle.
    function search(quadtree, x0, y0, x3, y3) {
        var selectedDataKeys = [];
        var key = this.config.columns.key;
        quadtree.visit(function (node, x1, y1, x2, y2) {
            var p = node.point;
            if (p) {
                p.scanned = true;
                var colXVal = this.internal.xScale(xValue.call(this, p), p.index);
                var colYVal = this.internal.yScale(yValue.call(this, p), p.index);
                p.selected = (colXVal >= x0) && (colXVal < x3) && (colYVal >= y0) && (colYVal < y3);
                if (p.selected)
                    selectedDataKeys.push(p[key]);
            }
            return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
        }.bind(this));
        return selectedDataKeys;
    }

    function brushListener() {
        var onSelect = this.config.interactions.onSelect;
        var extent = this.internal.brush.extent();
        this.internal.point.each(function (d) {
            d.scanned = d.selected = false;
        });
        var keys = search.call(this, this.internal.quadTree, extent[0][0], extent[0][1], extent[1][0], extent[1][1]);
        this.select();
        if (keys) {
            if (onSelect && onSelect.callback) {
                onSelect.callback.call(this, keys);
            }
        }

    }

    function nearest(x, y, best, node) {
        var x1 = node.x1,
            y1 = node.y1,
            x2 = node.x2,
            y2 = node.y2;
        node.visited = true;
        // exclude node if point is farther away than best distance in either axis
        if (x < x1 - best.d || x > x2 + best.d || y < y1 - best.d || y > y2 + best.d) {
            return best;
        }
        // test point if there is one, potentially updating best
        var p = node.point;
        if (p) {
            p.scanned = true;
            var dx = this.internal.xScale(xValue.call(this, p), p.index) - x,
                dy = this.internal.yScale(yValue.call(this, p), p.index) - y,
                d = Math.sqrt(dx * dx + dy * dy);
            if (d < best.d) {
                best.d = d;
                best.p = p;
            }
        }
        // check if kid is on the right or left, and top or bottom
        // and then recurse on most likely kids first, so we quickly find a
        // nearby point and then exclude many larger rectangles later
        var kids = node.nodes;
        var rl = (2 * x > x1 + x2),
            bt = (2 * y > y1 + y2);
        if (kids[bt * 2 + rl]) best = nearest.call(this, x, y, best, kids[bt * 2 + rl]);
        if (kids[bt * 2 + (1 - rl)]) best = nearest.call(this, x, y, best, kids[bt * 2 + (1 - rl)]);
        if (kids[(1 - bt) * 2 + rl]) best = nearest.call(this, x, y, best, kids[(1 - bt) * 2 + rl]);
        if (kids[(1 - bt) * 2 + (1 - rl)]) best = nearest.call(this, x, y, best, kids[(1 - bt) * 2 + (1 - rl)]);

        return best;
    }


    function mousemoveListener() {
        var onProbe = this.config.interactions.onProbe;
        var key = this.config.columns.key;
        var x = +this.internal.probeCircle.attr('cx'),
            y = +this.internal.probeCircle.attr('cy');

        this.internal.point.each(function (d) {
            d.scanned = d.selected = false;
        });
        this.internal.kdRect.each(function (d) {
            d.visited = false;
        });

        var best = nearest.call(this, x, y, {
            d: 8,
            p: null
        }, this.internal.quadTree);
        if (best.p) {
            best.p.selected = true;
        }
        // not sure is this the right way, will check
        this.probe();
        if (onProbe && onProbe.callback) {
            if (best.p) {
                onProbe.callback.call(this, best.p[key]);
            } else {
                onProbe.callback.call(this, null);
            }
        }
    }




    // PDS Collect a list of nodes to draw rectangles, adding extent and depth data
    function createNodes(quadtree) {
        var nodes = [];
        quadtree.depth = 0; // root
        quadtree.visit(function (node, x1, y1, x2, y2) {
            node.x1 = x1;
            node.y1 = y1;
            node.x2 = x2;
            node.y2 = y2;
            nodes.push(node);
            for (var i = 0; i < 4; i++) {
                if (node.nodes[i]) node.nodes[i].depth = node.depth + 1;
            }
        });
        return nodes;
    }



    function responsivefy(svg) {
        // get container
        // var container = d3.select(svg.node().parentNode);
        var width = parseInt(svg.style("width"));
        var height = parseInt(svg.style("height"));
        //aspect = width / height;


        var chart = this;

        // add viewBox
        // and call resize so that svg resizes on inital page load
        svg.attr("viewBox", "0 0 " + width + " " + height)
            .attr("perserveAspectRatio", "none")
            .call(resizeFunction.bind(null, chart, svg));



        // to register multiple listeners for same event type,
        // you need to add namespace, i.e., 'click.foo'
        // necessary if you call invoke this function for multiple svgs
        // api docs: https://github.com/mbostock/d3/wiki/Selections#on
        d3.select(window).on("resize." + this.internal.container.attr('id'), resizeFunction.bind(null, chart, svg));



    }

    function resizeFunction(chart, svg) {
        var targetWidth = parseInt(chart.internal.container.style("width"));
        var targetHeight = parseInt(chart.internal.container.style("height"));
        console.log('resize: ', targetWidth, targetHeight);

        svg.attr("width", targetWidth);
        //svg.attr("height", targetHeight);
    }


    /*
     * value accessor - returns the value to encode for a given data object.
     * scale - maps value to a visual display encoding, such as a pixel position.
     * map function - maps from data value to display value
     * axis - sets up axis
     */
    function initializeChart() {
        var chart = this;

        // define the xScale function
        this.internal.xScale = d3.scale.linear()
            .range([0, this.config.size.width]); // value -> display

        // define the xAxis function
        this.internal.xAxis = d3.svg.axis()
            .scale(this.internal.xScale)
            .orient("bottom")
            .tickFormat(function (i) {
                // i is the value here for the particular column
                var label = i;
                if (chart.internal.xColumnType === 'string') {
                    var record = chart.config.data[i];
                    if (record)
                        label = record[chart.config.columns.x];
                    else
                        label = '';
                }

                return label;
            });

        // define the yScale function
        this.internal.yScale = d3.scale.linear()
            .range([this.config.size.height, 0]); // value -> display

        // define the yAxis function
        this.internal.yAxis = d3.svg.axis()
            .scale(this.internal.yScale)
            .orient("left")
            .tickFormat(function (i) {
                // i is the value here for the particular column
                var label = i;
                if (chart.internal.yColumnType === 'string') {
                    var record = chart.config.data[i];
                    if (record)
                        label = record[chart.config.columns.y];
                    else
                        label = '';
                }

                return label;
            });

        // define the d3 selection array with SVG element in it
        this.internal.svg = this.internal.container.append("svg")
            .attr("width", this.config.size.width + this.config.margin.left + this.config.margin.right)
            .attr("height", this.config.size.height + this.config.margin.top + this.config.margin.bottom)
            .call(responsivefy.bind(this));

        // define the d3 selction array with Group element, where axis and Points are drawn
        this.internal.chartGroup = this.internal.svg.append("g")
            .attr("transform", "translate(" + this.config.margin.left + "," + this.config.margin.top + ")")
            .on("mousemove", function (d) {
                var xy = d3.mouse(d3.select(this)[0][0]);
                chart.internal.probeCircle.attr("cx", xy[0]);
                chart.internal.probeCircle.attr("cy", xy[1]);
                mousemoveListener.call(chart);
            });

        /*kdColor = d3.scale.linear()
            .domain([0, 8]) // max depth of quadtree
            .range(["#efe", "#060"]);*/

        // Brush for Selection
        this.internal.brush = d3.svg.brush()
            .x(d3.scale.identity().domain([0 - 5, this.config.size.width + 5]))
            .y(d3.scale.identity().domain([0 - 5, this.config.size.height + 5]))
            .on("brush", brushListener.bind(chart));


        // define the d3 selction array with Group element, brush rectangle is drawn
        this.internal.chartGroup.append("g")
            .attr("class", "brush")
            .call(this.internal.brush);


        // probe Circle
        this.internal.probeCircle = this.internal.chartGroup.append("circle")
            .attr("id", this.config.container.id + "pt")
            .attr("r", 6)
            .style("fill", "none");

        // defines a function to generate quadtree
        this.internal.quadTreeFactory = d3.geom.quadtree()
            .extent([[0, 0], [this.config.size.width, this.config.size.height]])
            .x(xMap.bind(this))
            .y(yMap.bind(this));


    }

    var p = Scatterplot.prototype;

    p.create = function (config) {
        //to-do Implement a better way to maintian config Json
        this.config = {};
        if (config.container) {
            if (config.container.constructor.name === 'String') {
                this.config.container = {
                    'element': document.getElementById(config.container),
                    'id': config.container
                };

            } else {
                //to-do check its dom element if so, get its ID too
                // added flag to check HTMLDivElementConstructor as this the constructor it gave in mobile ... need to double verify this
                if (config.container.constructor.name === 'HTMLDivElement' || config.container.constructor === HTMLDivElementConstructor) {
                    this.config.container = {
                        'element': config.container,
                        'id': config.container.id
                    };
                } else {
                    console.log("Error: " + config.container + " - Not a HTMLDivElement element ")
                }

            }

        } else {
            if (this.config.container.constructor.name === 'String') {
                this.config.container = {
                    'element': document.getElementById(config.container),
                    'id': 'body'
                };
            }

        }

        this.internal.container = d3.select(this.config.container.element);

        if (config.size) {
            this.config.size = config.size;
            if (!config.size.width) this.config.size.width = parseInt(this.internal.container.style('width'), 10);
            if (!config.size.height) {
                this.config.size.height = parseInt(this.internal.container.style('height'), 10);
                if (this.config.size.height == 0) this.config.size.height = 400 // when div dont have child value will be zero
            }

        } else {
            this.config.size = {};
            this.config.size.width = parseInt(this.internal.container.style('width'), 10);
            this.config.size.height = parseInt(this.internal.container.style('height'), 10);
            if (this.config.size.height == 0) this.config.size.height = 400 // when div dont have child value will be zero
        }
        if (config.margin) {
            this.config.margin = config.margin;
            if (!config.margin.left) this.config.margin.left = 20;
            if (!config.margin.right) this.config.margin.right = 20;
            if (!config.margin.top) this.config.margin.top = 20;
            if (!config.margin.bottom) this.config.margin.bottom = 20;
        } else {
            this.config.margin = {};
            this.config.margin.left = this.config.margin.right = this.config.margin.top = this.config.margin.bottom = 20;
        }

        if (config.columns) {
            this.config.columns = config.columns;
        } else {
            this.config.columns = {
                x: '',
                y: '',
                key: ''
            };
        }
        if (config.data) {
            this.config.data = config.data;
        } else {
            this.config.data = [];
        }

        if (config.interactions) {
            this.config.interactions = config.interactions;
        } else {
            this.config.interactions = {}
        }

        initializeChart.call(this);


    }

    p.setXAttribute = function (xColumn) {
        if (this.config.columns.x !== xColumn) {
            this.config.columns.x = xColumn;
            updateXaxis.call(this);
        }
    }

    function updateXaxis() {
        var data = this.config.data;
        var xCol = this.config.columns.x;

        this.internal.xScale.domain([d3.min(data, xValue.bind(this)), d3.max(data, xValue.bind(this))]);

        this.internal.quadTreeFactory.x(xMap.bind(this));
        this.internal.quadTree = this.internal.quadTreeFactory(data);
        this.internal.kdRect.data(createNodes(this.internal.quadTree));

        var container = d3.select(this.config.container.element).transition();

        container.selectAll(".point")
            .duration(750)
            .attr("cx", xMap.bind(this));

        container.selectAll(".node")
            .duration(750)
            .attr("x", function (d) {
                return d.x1;
            })
            .attr("y", function (d) {
                return d.y1;
            })
            .attr("width", function (d) {
                return d.x2 - d.x1;
            })
            .attr("height", function (d) {
                return d.y2 - d.y1;
            });


        /* if (this.internal.xColumnType === "string") {
             updateTickFormat.call(this, this.internal.xAxis, this.config.columns.x);
         }*/

        container.select(".x.axis") // change the x axis
            .duration(750)
            .call(this.internal.xAxis)
            .selectAll("text") //tick labels are selected
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", function (d) {
                return "rotate(-45)"
            });




        this.internal.xAxisLabel.text(xCol);
    }

    p.setYAttribute = function (yColumn) {
        if (this.config.columns.y !== yColumn) {
            this.config.columns.y = yColumn;
            updateYaxis.call(this);
        }
    }



    function updateYaxis() {

        var data = this.config.data;
        var yCol = this.config.columns.y;

        this.internal.yScale.domain([d3.min(data, yValue.bind(this)), d3.max(data, yValue.bind(this))]);

        this.internal.quadTreeFactory.y(yMap.bind(this));
        this.internal.quadTree = this.internal.quadTreeFactory(data);
        this.internal.kdRect.data(createNodes(this.internal.quadTree));

        var container = d3.select(this.config.container.element).transition();

        container.selectAll(".point")
            .duration(750)
            .attr("cy", yMap.bind(this));

        container.selectAll(".node")
            .duration(750)
            .attr("x", function (d) {
                return d.x1;
            })
            .attr("y", function (d) {
                return d.y1;
            })
            .attr("width", function (d) {
                return d.x2 - d.x1;
            })
            .attr("height", function (d) {
                return d.y2 - d.y1;
            });

        /*if (this.internal.yColumnType === "string") {
            updateTickFormat.call(this, this.internal.yAxis, this.config.columns.y);
        }*/

        container.select(".y.axis") // change the y axis
            .duration(750)
            .call(this.internal.yAxis)
            .selectAll("text") //tick labels are selected
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("transform", function (d) {
                return "rotate(-45)"
            });

        this.internal.yAxisLabel.text(yCol);
    }

    function tickFormatter(index, colName) {
        var labels = this.config.data.map(function (d, i) {
            return d[colName];
        }.bind(this));
        return labels[index];
    }

    function updateTickFormat(axis, column) {
        axis.tickFormat(function (column, i) {
            var label = tickFormatter.call(this, i, column);
            return label;
        }.bind(this, column));
    }


    p.renderChart = function (records) {

        if (records)
            this.config.data = records;
        if (!this.config.data) {
            console.log('Data not found');
            return;
        }

        var columns = this.config.columns;
        if (!columns.x) {
            console.log('x column not set yet');
            return;
        }

        if (!columns.y) {
            console.log('y column not set yet');
            return;
        }

        if (!columns.key) {
            console.log('key column not set yet: Key column is must for interaction between charts');
            return;
        }

        var data = this.config.data;

        // set the domain value for xScale function based on data min and max value
        this.internal.xScale.domain([d3.min(data, xValue.bind(this)), d3.max(data, xValue.bind(this))]);
        this.internal.yScale.domain([d3.min(data, yValue.bind(this)), d3.max(data, yValue.bind(this))]);

        this.internal.quadTree = this.internal.quadTreeFactory(data);

        //set number of ticks we want
        //this.internal.xAxis.ticks(data.length);

        //if (this.internal.xColumnType === "string") {
        // updateTickFormat.call(this, this.internal.xAxis, this.config.columns.x);
        //}
        // x-axis
        this.internal.chartGroup.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + this.config.size.height + ")")
            .call(this.internal.xAxis) // this will call xAxis Function with current 'g' element and creates ticks and and its labels
            .selectAll("text") //tick labels are selected
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", function (d) {
                return "rotate(-45)"
            });

        // x-axis column name tex text is defined
        this.internal.xAxisLabel = this.internal.chartGroup.append("text")
            .attr("y", this.config.size.height + this.config.margin.top + this.config.margin.bottom / 2)
            .attr("x", this.config.size.width / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(columns.x);

        //if (this.internal.yColumnType === "string") {

        //updateTickFormat.call(this, this.internal.yAxis, this.config.columns.y);
        // }

        // y-axis
        this.internal.chartGroup.append("g")
            .attr("class", "y axis")
            .call(this.internal.yAxis)
            .selectAll("text") //tick labels are selected
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("transform", function (d) {
                return "rotate(-45)"
            });

        this.internal.yAxisLabel = this.internal.chartGroup.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.config.margin.left)
            .attr("x", 0 - this.config.size.height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(columns.y);


        this.internal.kdRect = this.internal.chartGroup.selectAll(".node")
            .data(createNodes(this.internal.quadTree))
            .enter().append("rect")
            .attr("class", "node")
            .attr("x", function (d) {
                return d.x1;
            })
            .attr("y", function (d) {
                return d.y1;
            })
            .attr("width", function (d) {
                return d.x2 - d.x1;
            })
            .attr("height", function (d) {
                return d.y2 - d.y1;
            });

        // draw dots
        this.internal.point = this.internal.chartGroup.selectAll(".point")
            .data(data)
            .enter().append("circle")
            .attr("class", "point")
            .attr("r", 6)
            .attr("cx", xMap.bind(this))
            .attr("cy", yMap.bind(this));

    }


    // key required for API call
    // Internal calls doesnt require
    p.probe = function (key) {
        var data = this.config.data;
        var keyCol = this.config.columns.key;
        if (key) {
            this.internal.point.each(function (d) {
                d.scanned = d.selected = false;
            });
            data.map(function (d) {
                if (d[keyCol] == key) d.selected = true;
            })
        } else if (key === null) {
            this.internal.point.each(function (d) {
                d.scanned = d.selected = false;
            });
        }
        this.internal.point.classed("scanned", function (d) {
            return d.scanned;
        });
        this.internal.point.classed("selected", function (d) {
            return d.selected;
        });
    }

    // keys required for API call
    // Internal calls doesnt require
    p.select = function (keys) {
        var data = this.config.data;

        if (keys) {
            this.internal.point.each(function (d) {
                d.scanned = d.selected = false;
            });
            data.filter(function (d) {
                for (var i = 0; i < keys.length; i++) {
                    if (d[this.config.columns.key] === keys[i])
                        d.selected = true;
                }
            }.bind(this))

        }
        if (keys && keys.length === 0) {
            this.internal.point.each(function (d) {
                d.scanned = d.selected = false;
            });
        }

        this.internal.point.classed("scanned", function (d) {
            return d.scanned;
        });
        this.internal.point.classed("selected", function (d) {
            return d.selected;
        });
    }

    p.dispose = function () {
        //d3.select(window).on("resize." + this.internal.container.attr('id'), resizeFunction.bind(null, chart, svg));
        if (window.detachEvent) {
            window.detachEvent('onresize', resizeFunction);
        } else if (window.removeEventListener) {
            window.removeEventListener('resize', resizeFunction);
        }

    }



    d3Chart.Scatterplot = Scatterplot;



}());