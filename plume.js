import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { dotPlot } from "./dotPlot.js"

export class plume {
  constructor(parent) {
    this._parent = parent;
    this._width = 800;
    this._height = 400;
    this._margins = {
      top: 10,
      right: 30,
      bottom: 30,
      left: 30
    };
    this._utcTime = false;
    this._timeFormat = "%Y-%m-%d %H:%M:%S";
    this._validTimeKey = "valid_dttm";
    this._data = null;
    this._paramKey = null;
    this._paramUnit = "";
    this._plumeColours = {
      inner: "seagreen",
      middle: "mediumseagreen",
      outer: "lightseagreen"
    };
    this._bg = "#FFF";
    this._minY = null;
    this._maxY = null;
    this._textColour = "#000";
    this._testVal = null;
    this._threshold = null;
    this._binStep = 1;
    this._forceStep = false;
  }

  size(w, h) {
    this._width = w;
    this._height = h;
    return this;
  }

  margins(t, r, b, l) {
    this._margins = { top: t, right: r, bottom: b, left: l };
    return this;
  }

  colours(i, m, o) {
    this._plumeColours = { inner: i, middle: m, outer: o };
    return this;
  }

  bg(c) {
    this._bg = c;
    return this;
  }

  textColour(c) {
    this._textColour = c;
    return this;
  }

  utcTime(utc) {
    this._utcTime = utc;
    return this;
  }

  timeFormat(t) {
    this._timeFormat = t;
    return this;
  }

  validTimeKey(k) {
    this._validTimeKey = k;
    return this;
  }

  data(data) {
    this._data = data;
    return this;
  }

  threshold(t) {
    this._threshold = t;
    return this;
  }

  binSize(b) {
    this._binStep = b;
    return this;
  }
  forceBinSize(f) {
    this._forceStep = f;
    return this;
  }

  paramKey(k) {
    this._paramKey = k;
    return this;
  }

  paramUnit(u) {
    this._paramUnit = u;
    return this;
  }

  ylim(l, h) {
    const yLims = [l, h].sort();
    this._minY = yLims[0];
    this._maxY = yLims[1];
    return this;
  }

  test() {
    this._testVal = this._toQuantiles();
    //this._testVal = this._toDays();
    return this;
  }

  render() {
    this._drawPlume();
    return this;
  }

  //

  _toQuantiles() {
    return d3.flatRollup(
      this._data,
      (v) => ({
        q00: d3.min(v.map((d) => d[this._paramKey])),
        q10: d3.quantile(
          v.map((d) => d[this._paramKey]),
          0.1
        ),
        q25: d3.quantile(
          v.map((d) => d[this._paramKey]),
          0.25
        ),
        q50: d3.quantile(
          v.map((d) => d[this._paramKey]),
          0.5
        ),
        q75: d3.quantile(
          v.map((d) => d[this._paramKey]),
          0.75
        ),
        q90: d3.quantile(
          v.map((d) => d[this._paramKey]),
          0.9
        ),
        q100: d3.max(v.map((d) => d[this._paramKey])),
        mean: d3.mean(v.map((d) => d[this._paramKey])),
        control: v.filter(d => d.member === "mbr000")[0][this._paramKey],
        prob: d3.mean(v.map(d => d[this._paramKey] >= this._threshold ? 1 : 0))
      }),
      (d) => d[this._validTimeKey]
    );
  }

  _toPlumes() {
    const quantileData = this._toQuantiles();
    return d3.groups(
      quantileData
        .map((d) => ({
          time: d[0],
          min: d[1].q00,
          max: d[1].q100,
          range: "q00q100"
        }))
        .concat(
          quantileData.map((d) => ({
            time: d[0],
            min: d[1].q10,
            max: d[1].q90,
            range: "q10q90"
          }))
        )
        .concat(
          quantileData.map((d) => ({
            time: d[0],
            min: d[1].q25,
            max: d[1].q75,
            range: "q25q75"
          }))
        ),
      (d) => d.range
    );
  }

  _toDays() {
    return [...new Set(
      this._data.filter(d => d3.utcFormat("%H")(this._timeParser(d[this._validTimeKey])) == "00").map(d => d[this._validTimeKey])
    )].map(
      d => ({
        data: [
          { time: this._timeParser(d), y: 0 },
          { time: this._timeParser(d), y: this._height - this._margins.bottom - this._margins.top }
        ],
        text: d3.utcFormat("%a %d %b")(this._timeParser(d)),
      })
    )
  }

  _timeParser(t) {
    return this._utcTime
      ? d3.utcParse(this._timeFormat)(t)
      : d3.timeParse(this._timeFormat)(t);
  }

  _drawPlume() {

    this._parent.style("background-color", `${this._bg}`);

    const selectOrAppend = (elementType, className, parent) => {
      const selection = parent.select("." + className);
      if (!selection.empty()) return selection;
      return parent.append(elementType).attr("class", className);
    };

    const x = d3
      .scaleTime()
      .domain(
        d3.extent(
          this._data.map((d) => this._timeParser(d[this._validTimeKey]))
        )
      )
      .range([0, this._width - this._margins.left - this._margins.right]);

    const minY = this._minY
      ? this._minY
      : d3.min(this._data, (d) => d[this._paramKey]);
    const maxY = this._maxY
      ? this._maxY
      : d3.max(this._data, (d) => d[this._paramKey]);

    const y = d3
      .scaleLinear()
      .domain([minY, maxY])
      .range([this._height - this._margins.bottom - this._margins.top, 0])
      .nice();

    const areaGenerator = d3
      .area()
      .curve(d3.curveMonotoneX)
      .x((d) => x(this._timeParser(d.time)))
      .y0((d) => y(d.min))
      .y1((d) => y(d.max));

    const lineGenerator = d3
      .line()
      .curve(d3.curveMonotoneX)
      .x((d) => x(this._timeParser(d.time)))
      .y((d) => y(d));

    const dayLineGenerator = d3.line()
      .x(d => x(d.time))
      .y(d => d.y);

    const bounds = selectOrAppend("g", "bounds", this._parent).attr(
      "transform",
      `translate(${this._margins.left},${this._margins.top})`
    );

    const plumes = selectOrAppend("g", "plumes", bounds)
      .selectAll("path")
      .data(this._toPlumes())
      .join("path")
      .attr("fill", (d) =>
        d[0] === "q00q100"
          ? this._plumeColours.outer
          : d[0] === "q10q90"
            ? this._plumeColours.middle
            : this._plumeColours.inner
      )
      .attr("d", (d) => areaGenerator(d[1]));

    const xAxis = selectOrAppend("g", "xAxis", bounds)
      .style("font-size", 10)
      .attr("transform", `translate(0, ${this._height - this._margins.bottom - this._margins.top})`)
      .attr("color", `${this._textColour}`)
      .call(d3.axisBottom(x).tickFormat(d3.utcFormat("%H")).ticks(d3.utcHour.every(6)));

    const yAxis = selectOrAppend("g", "yAxis", bounds)
      .style("font-size", 10)
      .attr("color", `${this._textColour}`)
      .call(d3.axisLeft(y).ticks(5))

    const dayLines = selectOrAppend("g", "dayLines", bounds)
      .selectAll("path")
      .data(this._toDays())
      .join("path")
      .attr("fill", "none")
      .attr("stroke", `${this._textColour}`)
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.5)
      .attr("d", d => dayLineGenerator(d.data))

    const dayText = selectOrAppend("g", "dayText", bounds)
      .selectAll("text")
      .data(this._toDays())
      .join("text")
      .attr("fill", `${this._textColour}`)
      .attr("x", d => x(d.data[0].time))
      .attr("y", d => 0 - this._margins.top * 0.1)
      .attr("font-size", 10)
      .text(d => d.text)

    const validTimes = d3.groups(this._data, d => d[this._validTimeKey])
    const barWidths = x(this._timeParser(validTimes[1][0])) - x(this._timeParser(validTimes[0][0]))

    const tooltip = selectOrAppend("div", "d3-tooltip", d3.select("body"))
      .style('position', 'absolute')
      .style('z-index', '10')
      .style('opacity', 0)
      .style('padding', '10px')
      .style('background', '#FFF')
      .style('border-radius', '4px')
      .style('color', '#333')
      .style("border-style", "solid")
      .style("border-color", "#C33")
      .style("font-family", "sans-serif")
      .text('a simple tooltip');

    const tooltipReveal = (event, d) => {
      tooltipBars.attr("opacity", b => b[0] === d[0] ? 0.5 : 0)
      const xPos = x(d[0])
      const dataNow = this._data.filter(dd => dd[this._validTimeKey] === d[0])
      const totalMembers = dataNow.length
      const exceedenceMembers = dataNow.filter(dd => dd[this._paramKey] >= this._threshold).length
      tooltip
        .html(`<div id="plume-tooltip">
                  <p style="margin: 0; font-size: 0.75em"><u>${d3.utcFormat("%H:%M %a %d %b %Y")(this._timeParser(d[0]))}</u></p>
                  <p style="margin: 0; font-size: 0.75em">${exceedenceMembers} of ${totalMembers} members &#8805 ${this._threshold}</p>
                </div>`
        )
        .style('opacity', 0.8);

      new dotPlot("plume-tooltip")
        .data(dataNow)
        .paramKey(this._paramKey)
        .threshold(this._threshold)
        .step(this._binStep)
        .force(this._forceStep)
        .colours(this._plumeColours.inner, this._plumeColours.outer)
        .render()
    }

    const tooltipHide = () => {
      tooltipBars.attr("opacity", 0)
      tooltip.style("opacity", 0).html("")
    }

    const tooltipMove = (event, d) => {
      const xPos = x(this._timeParser(d[0])) > (this._width - this._margins.left - 158) ? -178 : 10;
      tooltip
        .style('top', event.pageY - 10 + 'px')
        .style('left', event.pageX + xPos + 'px');
    }

    const tooltipBars = selectOrAppend("g", "tooltipBars", bounds)
      .selectAll("rect")
      .data(this._toQuantiles())
      .join("rect")
      .attr("stroke-width", 0)
      .attr("fill", "#CCC")
      .attr("opacity", 0)
      .attr("x", d => x(this._timeParser(d[0])) - barWidths / 2)
      .attr("y", 0)
      .attr("width", barWidths)
      .attr("height", this._height - this._margins.top - this._margins.bottom)
      .on("mouseenter", tooltipReveal)
      .on("mouseleave", tooltipHide)
      .on("mousemove", tooltipMove)

    if (this._threshold) {
      d3.select("#threshLine").remove()
      d3.select("#threshText").remove()

      const yVal = y(this._threshold) < -1 | y(this._threshold) > (this._height - this._margins.top - this._margins.bottom)
        ? null
        : y(this._threshold)

      const threshData = [
        { x: 0, y: yVal },
        { x: this._width - this._margins.left - this._margins.right / 2, y: yVal }
      ];

      if (yVal) {
        const threshLine = selectOrAppend("g", "threshLine", bounds)
          .append("path")
          .attr("id", "threshLine")
          .attr("stroke-width", 1)
          .attr("stroke", this._textColour)
          .attr("d", d3.line().x(d => d.x).y(d => d.y)(threshData))

        const threshText = selectOrAppend("g", "threshText", bounds)
          .append("text")
          .attr("id", "threshText")
          .attr("fill", this._textColour)
          .attr("x", this._width - this._margins.left - this._margins.right + 2)
          .attr("y", yVal - 2)
          .attr("font-size", 10)
          .html(`${this._threshold}` + this._paramUnit)
      }


    }

  };

}