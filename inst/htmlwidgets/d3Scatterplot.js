HTMLWidgets.widget({

  name: 'd3Scatterplot',

  type: 'output',

  initialize: function(el, width, height) {
	
	var chart = new d3Chart.Scatterplot(config);
	
    return {
     el:el,
	 width: width,
	 height: height,
	 chart:chart
    }

  },

  renderValue: function(el, p, instance) {
	console.log("el", el);
	console.log("p", p);
	console.log("instance", instance);
	//chart.setXAttribute(p.config.columns.x)
	//chart..setYAttribute(p.config.columns.y)

  },

  resize: function(el, width, height, instance) {

  }

});
