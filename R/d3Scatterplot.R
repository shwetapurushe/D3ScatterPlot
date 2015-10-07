#' <Add Title>
#'
#' <Add Description>
#'
#' @import htmlwidgets
#'
#' @export
d3Scatterplot <- function(config) {

  # forward options using p
  #parameters sent to the widget, in this case only one object
  p = list(
    config = config
  )

  # create widget
  htmlwidgets::createWidget(
    name = 'd3Scatterplot',
    p,
    width = 700,
    height = 700,
    package = 'd3Scatterplot'
  )
}

#' Widget output function for use in Shiny
#'
#' @export
d3ScatterplotOutput <- function(outputId, width = '100%', height = '400px'){
  shinyWidgetOutput(outputId, 'd3Scatterplot', width, height, package = 'd3Scatterplot')
}

#' Widget render function for use in Shiny
#'
#' @export
renderD3Scatterplot <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  shinyRenderWidget(expr, d3ScatterplotOutput, env, quoted = TRUE)
}

#DATA
x <- c(11, 25, 37, 48, 90, 44, 67, 78, 23)
y <- c(12, 78, 99, 38, 24, 77, 34, 89, 13)
columns <- data.frame(x,y)

#CONFIG OBJECT

config <- list(
			data = columns,
			margin = list(top = 40, bottom =140, left=80, right=20),
			width = 900,
			height = 500
)


