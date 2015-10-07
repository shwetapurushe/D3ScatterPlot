var shweta;
HTMLWidgets.widget({

  name: 'd3Scatterplot',

  type: 'output',

  initialize: function(el, width, height) {
    return {
     el:el,
	 width: width,
	 height: height
    }

  },

  //p contains the data needed
  //instance is the obj of d3 scatter plot
  renderValue: function(el, p, instance) {
      p.config.container = el.id;

      var keys = Object.keys(p.config.data);
      var cols = p.config.data
      var counter = cols[keys[0]].length;
      var rows = [];

      for(var i = 0;i< counter; i++){//will run four times
        var obj = {};
        for(var j = 0; j<keys.length; j++){
            obj[keys[j]] = cols[keys[j]][i];
        }
        rows.push(obj);
      }

      console.log(rows);
      p.config.data = rows;
      p.config.columns = {x:keys[0],y:keys[1],key:keys[0]};
      var chart = new d3Chart.Scatterplot(p.config);



      console.log("el", el);
      console.log("p", p);
      console.log("instance", instance);
      //chart.setXAttribute(p.config.columns.x)
      //chart..setYAttribute(p.config.columns.y)

  },

  resize: function(el, width, height, instance) {

  }

});
