// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYTRzaGkiLCJhIjoiY203YjVtYXhmMGIwdDJrcHc1Ym5kbHpqciJ9.A3l23yCQealGw-VZ9U-Z7w';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

let line_styles = {
    'line-color': '#32D400',  // A bright green using hex code
    'line-width': 5,          // Thicker lines
    'line-opacity': 0.6       // Slightly less transparent
};

let stations;
const svg = d3.select('#map').select('svg');
let circles;
let trips;

map.on('load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });
    map.addLayer({
        id: 'bike-lanes-boston',
        type: 'line',
        source: 'boston_route',
        paint: line_styles
    });
    
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: line_styles
    });
    
    // Load the nested JSON file
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
        stations = jsonData.data.stations;
        
        // Append circles to the SVG for each station
        circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', 5)               // Radius of the circle
        .attr('fill', 'steelblue')  // Circle fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.8)      // Circle opacity
        ;
        
        // Initial position update when map loads
        updatePositions();
    }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });

    d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv").then(data => {
        trips = data;
        console.log("Traffic data loaded", trips);
        
        departures = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.start_station_id,
        );
            
        let arrivals = d3.rollup(
            trips,
            (v) => v.length, // count the number of trips
            (d) => d.end_station_id // group by end station ID
        );
                
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });
                
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);
                
        circles
            .data(stations)
            .attr('r', (d) => radiusScale(d.totalTraffic));

        circles
            .each(function(d) {
                d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });
                
    }).catch(error => {
        console.error("Error loading the traffic data:", error);
    });            
});


function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}



// Function to update circle positions when the map moves/zooms
function updatePositions() {
    circles
    .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
    .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
}

// Reposition markers on map interactions
map.on('move', updatePositions);     // Update during map movement
map.on('zoom', updatePositions);     // Update during zooming
map.on('resize', updatePositions);   // Update on window resize
map.on('moveend', updatePositions);  // Final adjustment after movement ends


