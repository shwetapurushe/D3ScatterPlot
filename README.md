# D3ScatterPlot
d3 Scatter plot visualization ported to R using the htmlwidgets framework

##Installation
I'm hosting this package here and it is NOT available on CRAN. Install it from Github using the `devtools` package


```
library("devtools");
devtools::install_github("shwetapurushe/D3ScatterPlot");
```
And then try this
```
library("d3Scatterplot");
d3Scatterplot(config)
```

This will open a d3 scatter plot using data that had been provided in the config object. In R, the config object looks like    
`config <- list(
 			data = data.frame(vector1, vector2),
 			margin = list(top = 40, bottom =140, left=80, right=20),
 			width = 900,
 			height = 500
 )`