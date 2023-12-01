import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { plume } from "./plume.js"
import { stackedProb } from "./stackedProb.js"
import { radialBands } from "./radialBands.js"

// id for setInterval
let intervalId

// Set up parameter information
const getParamInfo = (param) => {
    const params = {
        temp: {
            name: "T2m",
            units: "&#8451",
            colours: [d3.interpolateBlues(0.8), d3.interpolateBlues(0.5), d3.interpolateBlues(0.2)],
            binSize: 1.0,
            fixedBinSize: false,
            type: "plume"
        },
        windspeed: {
            name: "S10m",
            units: "m/s",
            colours: [d3.interpolatePurples(0.8), d3.interpolatePurples(0.5), d3.interpolatePurples(0.2)],
            binSize: 1.0,
            fixedBinSize: false,
            type: "plume"
        },
        winddir: {
            name: "D10m",
            units: "&deg",
            colours: [d3.interpolateOranges(0.8), d3.interpolateOranges(0.5), d3.interpolateOranges(0.2)],
            binSize: 10.0,
            fixedBinSize: false,
            type: "radialBands"
        },
        precip: {
            name: "Pcp",
            units: "mm",
            binSize: 1.0,
            fixedBinSize: true,
            type: "stackedProb"
        },
        cloud: {
            name: "CAF",
            units: "%",
            colours: [d3.interpolateGreys(0.8), d3.interpolateGreys(0.5), d3.interpolateGreys(0.2)],
            binSize: 10.0,
            fixedBinSize: true,
            type: "plume"
        },
        hum: {
            name: "RH2m",
            units: "%",
            colours: [d3.interpolatePuBuGn(0.8), d3.interpolatePuBuGn(0.5), d3.interpolatePuBuGn(0.2)],
            binSize: 5.0,
            fixedBinSize: false,
            type: "plume"
        }
    }
    return (params[param])
}



// async function to load data

const getData = async () => {
    let data = await d3.json("./data/meps_major_cities_2022081500_1600.json")
    // Set any negative precipitation values to 0
    data = data.map(d => ("Pcp" in d) ? d.Pcp < 0 ? ({ ...d, Pcp: 0.0 }) : d : d)
    return data
}


// Set up chart dimensions

let width = Math.min(document.getElementById("main-container").clientWidth - 50, 1300);
let height = 200;
const margin = {
    top: 15,
    right: 40,
    bottom: 20,
    left: 40
};

const resize = () => {
    width = Math.min(document.getElementById("main-container").clientWidth - 50, 1300);
    console.log(width);
    refreshApp(dataJSON)
}

window.onresize = resize;

// Function to set up a plume plot
const plumeChart = (divID, data, param, thresh) => {

    let svg = d3.select("#" + param);

    if (svg.empty()) {
        svg = d3.create("svg")
            .attr("id", param)
            //.attr("viewBox", [0, 0, width, height])
            .attr("font-family", "sans-serif");
    }
    svg
        .attr("width", width)
        .attr("height", height)

    const currentParam = getParamInfo(param);

    new plume(svg)
        .data(data)
        .size(width, height)
        .paramKey(currentParam.name)
        .paramUnit(currentParam.units)
        .margins(margin.top, margin.right, margin.bottom, margin.left)
        .colours(...currentParam.colours)
        .bg("#FFF")
        .textColour("#999")
        .threshold(thresh)
        .binSize(currentParam.binSize)
        .forceBinSize(currentParam.fixedBinSize)
        .render()

    d3.select("#" + divID).append(() => svg.node())

}

// Function to set up a stacked probability plot
const stackChart = (divID, data, param, thresh) => {

    let svg = d3.select("#" + param);

    if (svg.empty()) {
        svg = d3.create("svg")
            .attr("id", param)
            //.attr("viewBox", [0, 0, width, height])
            .attr("font-family", "sans-serif");
    }
    svg
        .attr("width", width)
        .attr("height", height)

    const currentParam = getParamInfo(param);

    new stackedProb(svg)
        .data(data)
        .size(width, height)
        .paramKey(currentParam.name)
        .paramUnit(currentParam.units)
        .margins(margin.top, margin.right, margin.bottom, margin.left)
        //.colours(...currentParam.colours)
        .bg("#FFF")
        .textColour("#999")
        .threshold(thresh)
        .binSize(currentParam.binSize)
        .forceBinSize(currentParam.fixedBinSize)
        .render()

    d3.select("#" + divID).append(() => svg.node())

}

// Function to set up a radial bands plot
const radialBandChart = (divID, data, param, thresh) => {

    if (intervalId) {
        clearInterval(intervalId);
    }

    let svg = d3.select("#" + param);

    if (svg.empty()) {
        svg = d3.create("svg")
            .attr("id", param)
            //.attr("viewBox", [0, 0, width, height])
            .attr("font-family", "sans-serif");
    }
    svg
        .attr("width", width)
        .attr("height", height)

    const currentParam = getParamInfo(param);

    const radialPlot = new radialBands(svg)
        .data(data)
        .size(width, height)
        .paramKey(currentParam.name)
        .paramUnit(currentParam.units)
        .margins(margin.top, margin.right, margin.bottom, margin.left)
        //.colours(...currentParam.colours)
        .bg("#FFF")
        .textColour("#999")
        .threshold(thresh)
        .binSize(currentParam.binSize)
        .forceBinSize(currentParam.fixedBinSize)
        .animDelay(250)
        .animDuration(100)
        .render()

    d3.select("#" + divID).append(() => svg.node())

    return radialPlot.intervalId

}


// Function to refersh charts and sliders (creates on first call)
const refreshApp = async (dataIn, firstTime = false) => {
    const params = ["temp", "windspeed", "hum", "winddir", "cloud", "precip"]
    const data = await dataIn;

    // station selector
    if (firstTime) {
        const dropdown = document.getElementById("location-dropdown");
        dropdown.addEventListener("hide.bs.dropdown", (event) => {
            stationName = event.clickEvent.target.attributes[1].value;
            for (const prm of params) {
                updateThreshSlider(filterToLocation(data, stationName), prm);
                drawChart(filterToLocation(data, stationName), prm);
            }
        });
        const stations = [...new Set(data.map(d => d.name))].sort();
        const stationsList = document.getElementById("stations-list");
        for (let i = 0; i < stations.length; i++) {
            let opt = stations[i];
            let li = document.createElement("li");
            let link = document.createElement("a");
            let text = document.createTextNode(opt);
            link.appendChild(text);
            link.href = "#";
            link.setAttribute("value", opt);
            link.setAttribute("class", "dropdown-item")
            li.appendChild(link);
            stationsList.appendChild(li);
        }
     
        // Threshold Sliders
        for (const prm of params) {
            makeThreshSlider(data, prm);
        }
    }

    // Draw charts
    for (const prm of params) {
        d3.select("#" + prm + "svg")
            .attr("width", width)
            .attr("height", height);
        drawChart(data, prm, stationName);
    }
}

const dataJSON = getData();
let stationName;

refreshApp(dataJSON, true);

const filterToLocation = (data, loc) => {
    const h1Name = document.getElementById("station-name");
    if (typeof loc === "undefined") {
        const firstStation = [...new Set(data.map(d => d.name))].sort()[0];
        h1Name.innerHTML = firstStation;
        return data.filter(d => d.name === firstStation);
    } else {
        h1Name.innerHTML = loc;
        return data.filter(d => d.name === loc)
    }
}

const makeThreshSlider = (data, param) => {
    //const data = filterToLocation(dataIn);
    const currentParam = getParamInfo(param)
    const threshRange = d3.extent(data, d => d[currentParam.name]);
    const n = currentParam.binSize;
    const slider = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("id", param + "-threshold");
    slider.setAttribute("min", n * Math.floor(threshRange[0] / n));
    slider.setAttribute("max", n * Math.ceil(threshRange[1] / n));
    slider.setAttribute("value", n * Math.floor(threshRange[0] / n));
    slider.setAttribute("step", n);
    slider.addEventListener("input", event => drawChart(data, param, stationName));
    const sliderLabel = document.createElement("label");
    sliderLabel.setAttribute("for", param + "-threshold");
    sliderLabel.innerHTML = "<strong>   Threshold: </strong>";
    const threshContainer = document.getElementById("thresholds-" + param);
    threshContainer.appendChild(sliderLabel);
    threshContainer.appendChild(slider);

    if (param === "winddir") {
        const dropdown = document.createElement("select");
        dropdown.setAttribute("id", "choose-time")
        dropdown.addEventListener("change", (event) => {
            drawChart(data, param, stationName);
        });
        const times = [...new Set(data.map(d => d.valid_dttm))].sort();
        for (let i = 0; i < times.length; i++) {
            let opt = document.createElement("option");
            opt.text = times[i];
            opt.value = times[i];
            dropdown.options.add(opt);
        }
        dropdown.selectedIndex = 0;
        const dropdownLabel = document.createElement("label");
        dropdownLabel.setAttribute("for", "choose-time")
        dropdownLabel.innerHTML = "<strong>    Time: </strong>";
        threshContainer.appendChild(dropdownLabel);
        threshContainer.appendChild(dropdown);
    }
}

const updateThreshSlider = (dataIn, param, loc) => {
    const data = filterToLocation(dataIn, loc);
    const currentParam = getParamInfo(param)
    const threshRange = d3.extent(data, d => d[currentParam.name]);
    const n = currentParam.binSize;
    const slider = document.getElementById(param + "-threshold")
    slider.setAttribute("min", n * Math.floor(threshRange[0] / n));
    slider.setAttribute("max", n * Math.ceil(threshRange[1] / n));
    slider.setAttribute("value", n * Math.floor(threshRange[0] / n));
}

const drawChart = (dataIn, param, loc) => {

    let data = filterToLocation(dataIn, loc);

    // If wind direction, get the time
    if (param === "winddir") {
        const time = document.getElementById("choose-time").value;
        data = data.filter(d => d.valid_dttm === time);
    }


    // Get threshold from slider
    const slider = document.getElementById(param + "-threshold")
    const thresh = slider.value;
    const currentParam = getParamInfo(param)

    // Call the chart drawing function
    currentParam.type === "plume"
        ? plumeChart(param + "Container", data, param, thresh)
        : currentParam.type === "stackedProb"
            ? stackChart(param + "Container", data, param, thresh)
            : intervalId = radialBandChart(param + "Container", data, param, thresh)
}


