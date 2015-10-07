#' <Add Title>
#'
#' <Add Description>
#'
#' @import htmlwidgets
#'
#' @export
d3Scatterplot <- function(config) {

  # forward options using p
  p = list(
    config = config
  )

  # create widget
  htmlwidgets::createWidget(
    name = 'd3Scatterplot',
    p,
    width = config.width,
    height = config.height,
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
x <- c(1,2,3,4)
y <- c(5,6,7,8)

#making config
config <- list(
			columns = list(x = x, y = y)
			margin = list(top = 40, bottom =140, left=80, right=20),
			width = 700,
			height = 500
)


