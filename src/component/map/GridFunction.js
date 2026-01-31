import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Polygon from '@arcgis/core/geometry/Polygon'
import Polyline from '@arcgis/core/geometry/Polyline'
import Point from '@arcgis/core/geometry/Point'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import TextSymbol from '@arcgis/core/symbols/TextSymbol'
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine'
import { MAP, VIEW } from './RootFunction'
import $ from 'jquery'

// GraphicsLayer cho lưới
export let GRID_LAYER = null
let isDrawingGrid = false
let clickHandler = null
let startPoint = null
let tempRectangle = null
let startPointGraphic = null
let endPointGraphic = null

// Khởi tạo GraphicsLayer cho lưới
export const initGridLayer = () => {
  if (!GRID_LAYER) {
    GRID_LAYER = new GraphicsLayer()
    MAP.add(GRID_LAYER)
  }
  return GRID_LAYER
}

// Xóa lưới hiện tại
export const clearGrid = () => {
  if (GRID_LAYER) {
    GRID_LAYER.removeAll()
  }
}

// Bắt đầu vẽ lưới
export const startDrawingGrid = (onComplete) => {
  if (isDrawingGrid) {
    stopDrawingGrid()
  }

  initGridLayer()
  clearGrid()
  
  isDrawingGrid = true
  startPoint = null
  tempRectangle = null

  // Tạo symbol cho rectangle tạm thời
  const fillSymbol = {
    type: 'simple-fill',
    color: [0, 0, 255, 0.1],
    outline: {
      color: [0, 0, 255, 0.7],
      width: 2
    }
  }

  // Symbol cho điểm bắt đầu (màu xanh)
  const startPointSymbol = new SimpleMarkerSymbol({
    style: 'circle',
    color: [0, 255, 0, 0.8],
    size: 12,
    outline: {
      color: [255, 255, 255, 1],
      width: 2
    }
  })

  // Symbol cho điểm kết thúc (màu đỏ)
  const endPointSymbol = new SimpleMarkerSymbol({
    style: 'circle',
    color: [255, 0, 0, 0.8],
    size: 12,
    outline: {
      color: [255, 255, 255, 1],
      width: 2
    }
  })

  // Lắng nghe click event để vẽ rectangle
  clickHandler = VIEW.on('click', (event) => {
    // Kiểm tra mapPoint có tồn tại không
    if (!event || !event.mapPoint) {
      console.error('Invalid click event or mapPoint')
      return
    }

    const mapPoint = event.mapPoint

    if (!startPoint) {
      // Click đầu tiên - lưu điểm bắt đầu và hiển thị marker
      startPoint = mapPoint
      VIEW.cursor = 'crosshair'
      
      // Xóa điểm cũ nếu có
      if (startPointGraphic) {
        GRID_LAYER.remove(startPointGraphic)
      }
      
      // Hiển thị điểm bắt đầu
      const startPointGeometry = new Point({
        longitude: startPoint.longitude,
        latitude: startPoint.latitude,
        spatialReference: startPoint.spatialReference
      })

      startPointGraphic = new Graphic({
        geometry: startPointGeometry,
        symbol: startPointSymbol
      })

      GRID_LAYER.add(startPointGraphic)
      
      console.log('Điểm bắt đầu:', startPoint.longitude, startPoint.latitude)
    } else {
      // Click thứ hai - tạo rectangle và lưới
      const endPoint = mapPoint
      
      // Hiển thị điểm kết thúc
      if (endPointGraphic) {
        GRID_LAYER.remove(endPointGraphic)
      }
      
      const endPointGeometry = new Point({
        longitude: endPoint.longitude,
        latitude: endPoint.latitude,
        spatialReference: endPoint.spatialReference
      })

      endPointGraphic = new Graphic({
        geometry: endPointGeometry,
        symbol: endPointSymbol
      })

      GRID_LAYER.add(endPointGraphic)
      
      console.log('Điểm kết thúc:', endPoint.longitude, endPoint.latitude)
      
      // Tạo polygon rectangle
      const minX = Math.min(startPoint.longitude, endPoint.longitude)
      const maxX = Math.max(startPoint.longitude, endPoint.longitude)
      const minY = Math.min(startPoint.latitude, endPoint.latitude)
      const maxY = Math.max(startPoint.latitude, endPoint.latitude)
      
      const rectangleGeometry = new Polygon({
        rings: [[
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY]
        ]],
        spatialReference: startPoint.spatialReference
      })

      // Xóa rectangle tạm thời
      if (tempRectangle) {
        GRID_LAYER.remove(tempRectangle)
        tempRectangle = null
      }

      // Tạo lưới từ 2 điểm với khoảng cách 5m
      createGridFromTwoPoints(startPoint, endPoint, onComplete)
      stopDrawingGrid()
    }
  })

  // Lắng nghe pointer-move để vẽ rectangle tạm thời
  const moveHandler = VIEW.on('pointer-move', (event) => {
    if (startPoint && event && event.mapPoint) {
      const currentPoint = event.mapPoint
      
      // Xóa rectangle cũ
      if (tempRectangle) {
        GRID_LAYER.remove(tempRectangle)
      }

      // Tạo rectangle mới
      const minX = Math.min(startPoint.longitude, currentPoint.longitude)
      const maxX = Math.max(startPoint.longitude, currentPoint.longitude)
      const minY = Math.min(startPoint.latitude, currentPoint.latitude)
      const maxY = Math.max(startPoint.latitude, currentPoint.latitude)
      
      const rectangleGeometry = new Polygon({
        rings: [[
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY]
        ]],
        spatialReference: startPoint.spatialReference
      })

      tempRectangle = new Graphic({
        geometry: rectangleGeometry,
        symbol: fillSymbol
      })

      GRID_LAYER.add(tempRectangle)
    }
  })

  // Lưu moveHandler để có thể remove sau
  clickHandler.moveHandler = moveHandler

  return clickHandler
}

// Dừng vẽ lưới
export const stopDrawingGrid = () => {
  if (clickHandler) {
    clickHandler.remove()
    if (clickHandler.moveHandler) {
      clickHandler.moveHandler.remove()
    }
    clickHandler = null
  }
  
  if (tempRectangle) {
    if (GRID_LAYER) {
      GRID_LAYER.remove(tempRectangle)
    }
    tempRectangle = null
  }

  // Xóa các điểm marker
  if (startPointGraphic && GRID_LAYER) {
    GRID_LAYER.remove(startPointGraphic)
    startPointGraphic = null
  }

  if (endPointGraphic && GRID_LAYER) {
    GRID_LAYER.remove(endPointGraphic)
    endPointGraphic = null
  }
  
  startPoint = null
  VIEW.cursor = 'default'
  isDrawingGrid = false
}

// Tính khoảng cách giữa 2 điểm theo mét
const calculateDistanceInMeters = (point1, point2) => {
  try {
    const p1 = new Point({
      longitude: point1.longitude,
      latitude: point1.latitude,
      spatialReference: point1.spatialReference
    })
    const p2 = new Point({
      longitude: point2.longitude,
      latitude: point2.latitude,
      spatialReference: point2.spatialReference
    })
    return geometryEngine.distance(p1, p2, 'meters')
  } catch (error) {
    console.error('Error calculating distance:', error)
    return 0
  }
}

// Tạo điểm mới cách điểm gốc một khoảng cách nhất định theo hướng
// Sử dụng linear interpolation trên lat/lon (đủ chính xác cho khoảng cách nhỏ 5m)
const createPointAtDistance = (startPoint, endPoint, distanceInMeters, totalDistance) => {
  if (totalDistance === 0) return startPoint
  
  // Tính tỷ lệ khoảng cách
  const ratio = distanceInMeters / totalDistance
  
  // Linear interpolation trên tọa độ
  const lon = startPoint.longitude + (endPoint.longitude - startPoint.longitude) * ratio
  const lat = startPoint.latitude + (endPoint.latitude - startPoint.latitude) * ratio
  
  return {
    longitude: lon,
    latitude: lat,
    spatialReference: startPoint.spatialReference
  }
}

// Tính khoảng cách giữa 2 điểm theo chiều ngang (longitude)
const calculateHorizontalDistance = (point1, point2) => {
  try {
    const p1 = new Point({
      longitude: point1.longitude,
      latitude: point1.latitude,
      spatialReference: point1.spatialReference
    })
    const p2 = new Point({
      longitude: point2.longitude,
      latitude: point1.latitude, // Giữ nguyên latitude để tính khoảng cách ngang
      spatialReference: point2.spatialReference
    })
    return geometryEngine.distance(p1, p2, 'meters')
  } catch (error) {
    console.error('Error calculating horizontal distance:', error)
    return 0
  }
}

// Tính khoảng cách giữa 2 điểm theo chiều dọc (latitude)
const calculateVerticalDistance = (point1, point2) => {
  try {
    const p1 = new Point({
      longitude: point1.longitude,
      latitude: point1.latitude,
      spatialReference: point1.spatialReference
    })
    const p2 = new Point({
      longitude: point1.longitude, // Giữ nguyên longitude để tính khoảng cách dọc
      latitude: point2.latitude,
      spatialReference: point2.spatialReference
    })
    return geometryEngine.distance(p1, p2, 'meters')
  } catch (error) {
    console.error('Error calculating vertical distance:', error)
    return 0
  }
}

// Tạo lưới hình chữ nhật từ 2 điểm (2 góc đối diện) với khoảng cách 5m giữa các điểm
export const createGridFromTwoPoints = async (startPoint, endPoint, onComplete) => {
  if (!startPoint || !endPoint) {
    console.error('Invalid start or end point')
    return
  }

  const GRID_SPACING_METERS = 5 // Khoảng cách giữa các điểm: 5m

  // Xác định 4 góc của hình chữ nhật
  const minX = Math.min(startPoint.longitude, endPoint.longitude)
  const maxX = Math.max(startPoint.longitude, endPoint.longitude)
  const minY = Math.min(startPoint.latitude, endPoint.latitude)
  const maxY = Math.max(startPoint.latitude, endPoint.latitude)

  // Tạo 4 góc của hình chữ nhật
  const corner1 = { longitude: minX, latitude: minY, spatialReference: startPoint.spatialReference } // Góc dưới trái
  const corner2 = { longitude: maxX, latitude: minY, spatialReference: startPoint.spatialReference } // Góc dưới phải
  const corner3 = { longitude: maxX, latitude: maxY, spatialReference: startPoint.spatialReference } // Góc trên phải
  const corner4 = { longitude: minX, latitude: maxY, spatialReference: startPoint.spatialReference } // Góc trên trái

  // Tính khoảng cách theo chiều ngang (width) và chiều dọc (height)
  const widthMeters = calculateHorizontalDistance(corner1, corner2)
  const heightMeters = calculateVerticalDistance(corner1, corner4)

  console.log(`Khoảng cách ngang: ${widthMeters.toFixed(2)}m`)
  console.log(`Khoảng cách dọc: ${heightMeters.toFixed(2)}m`)

  if (widthMeters < GRID_SPACING_METERS || heightMeters < GRID_SPACING_METERS) {
    window.alert(`Khoảng cách giữa 2 điểm quá nhỏ. Khoảng cách tối thiểu phải là ${GRID_SPACING_METERS}m`)
    return
  }

  // Tính số cột và số hàng
  const numCols = Math.floor(widthMeters / GRID_SPACING_METERS) + 1
  const numRows = Math.floor(heightMeters / GRID_SPACING_METERS) + 1

  console.log(`Số cột: ${numCols}, Số hàng: ${numRows}`)
  console.log(`Tổng số điểm sẽ được tạo: ${numCols * numRows}`)

  // Tạo các điểm lưới
  const gridPoints = []
  const gridLines = []

  // Tạo các điểm lưới trong hình chữ nhật
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      // Tính tọa độ của điểm bằng interpolation
      const ratioX = numCols > 1 ? col / (numCols - 1) : 0
      const ratioY = numRows > 1 ? row / (numRows - 1) : 0
      
      let lon = minX + (maxX - minX) * ratioX
      let lat = minY + (maxY - minY) * ratioY

      // Đảm bảo điểm đầu và cuối chính xác
      const isStart = (row === 0 && col === 0)
      const isEnd = (Math.abs(lon - endPoint.longitude) < 0.00001 && 
                    Math.abs(lat - endPoint.latitude) < 0.00001)
      
      if (isStart) {
        // Điểm đầu phải chính xác là startPoint
        lon = startPoint.longitude
        lat = startPoint.latitude
      } else if (isEnd) {
        // Điểm cuối phải chính xác là endPoint
        lon = endPoint.longitude
        lat = endPoint.latitude
      }
      const isCorner = (row === 0 || row === numRows - 1) && (col === 0 || col === numCols - 1)
      const isEdge = (row === 0 || row === numRows - 1 || col === 0 || col === numCols - 1) && !isCorner
      const isInner = row > 0 && row < numRows - 1 && col > 0 && col < numCols - 1

      gridPoints.push({
        x: lon,
        y: lat,
        row: row,
        col: col,
        isStart: isStart,
        isEnd: isEnd,
        isCorner: isCorner,
        isEdge: isEdge,
        isInner: isInner
      })

      // Tạo đường lưới dọc (nối các điểm trong cùng một cột) - chỉ tạo một lần cho mỗi cột
      if (row === 0 && numRows > 1) {
        const path = []
        for (let r = 0; r < numRows; r++) {
          const ratioY = numRows > 1 ? r / (numRows - 1) : 0
          let pathLon = minX + (maxX - minX) * ratioX
          let pathLat = minY + (maxY - minY) * ratioY
          
          // Đảm bảo góc chính xác
          if (r === 0 && col === 0) {
            pathLon = startPoint.longitude
            pathLat = startPoint.latitude
          } else if (Math.abs(pathLon - endPoint.longitude) < 0.00001 && 
                     Math.abs(pathLat - endPoint.latitude) < 0.00001) {
            pathLon = endPoint.longitude
            pathLat = endPoint.latitude
          }
          
          path.push([pathLon, pathLat])
        }
        if (path.length > 1) {
          gridLines.push(path)
        }
      }

      // Tạo đường lưới ngang (nối các điểm trong cùng một hàng) - chỉ tạo một lần cho mỗi hàng
      if (col === 0 && numCols > 1) {
        const path = []
        for (let c = 0; c < numCols; c++) {
          const ratioX = numCols > 1 ? c / (numCols - 1) : 0
          let pathLon = minX + (maxX - minX) * ratioX
          let pathLat = minY + (maxY - minY) * ratioY
          
          // Đảm bảo góc chính xác
          if (row === 0 && c === 0) {
            pathLon = startPoint.longitude
            pathLat = startPoint.latitude
          } else if (Math.abs(pathLon - endPoint.longitude) < 0.00001 && 
                     Math.abs(pathLat - endPoint.latitude) < 0.00001) {
            pathLon = endPoint.longitude
            pathLat = endPoint.latitude
          }
          
          path.push([pathLon, pathLat])
        }
        if (path.length > 1) {
          gridLines.push(path)
        }
      }
    }
  }

  // Vẽ các đường lưới
  const lineSymbol = new SimpleLineSymbol({
    color: [0, 0, 255, 0.5],
    width: 2,
    style: 'solid'
  })

  gridLines.forEach((path) => {
    const polyline = new Polyline({
      paths: [path],
      spatialReference: startPoint.spatialReference
    })

    const lineGraphic = new Graphic({
      geometry: polyline,
      symbol: lineSymbol
    })

    GRID_LAYER.add(lineGraphic)
  })

  // Vẽ các điểm lưới
  const pointSymbol = new SimpleMarkerSymbol({
    style: 'circle',
    color: [255, 0, 0, 0.8],
    size: 8,
    outline: {
      color: [255, 255, 255, 1],
      width: 1
    }
  })

  // Lấy tọa độ cao độ cho tất cả các điểm
  const coordinatesWithElevation = await getElevationForPoints(gridPoints, startPoint.spatialReference)

  // Tính offset cho label (dựa trên khoảng cách trung bình)
  const avgDistance = Math.min(widthMeters / numCols, heightMeters / numRows)
  const labelOffset = avgDistance * 0.00001 // Offset nhỏ cho label

  // Vẽ các điểm và lưu tọa độ
  coordinatesWithElevation.forEach((point, index) => {
    const pointGeometry = new Point({
      longitude: point.x,
      latitude: point.y,
      spatialReference: startPoint.spatialReference
    })

    const pointGraphic = new Graphic({
      geometry: pointGeometry,
      symbol: pointSymbol
    })

    // Thêm label cho điểm
    const labelSymbol = new TextSymbol({
      color: 'black',
      text: `${point.row},${point.col}`,
      font: {
        size: 10,
        family: 'Arial'
      },
      haloColor: 'white',
      haloSize: 1
    })

    const labelPoint = new Point({
      longitude: point.x,
      latitude: point.y + labelOffset,
      spatialReference: startPoint.spatialReference
    })

    const labelGraphic = new Graphic({
      geometry: labelPoint,
      symbol: labelSymbol
    })

    GRID_LAYER.add(pointGraphic)
    GRID_LAYER.add(labelGraphic)
  })

  // Gọi callback với dữ liệu tọa độ
  if (onComplete) {
    onComplete(coordinatesWithElevation)
  }

  return coordinatesWithElevation
}

// Lấy cao độ cho các điểm sử dụng nhiều phương pháp
export const getElevationForPoints = async (points, spatialReference) => {
  try {
    console.log(`Querying elevation for ${points.length} points...`)
    console.log('Spatial reference:', spatialReference)
    
    const allPointsWithElevation = []
    
    // Chia points thành các batch để query
    const batchSize = 100
    const batches = []
    for (let i = 0; i < points.length; i += batchSize) {
      batches.push(points.slice(i, i + batchSize))
    }

    // Thử nhiều phương pháp để lấy elevation
    for (const batch of batches) {
      let batchProcessed = false
      
      // Phương pháp 1: Thử VIEW.ground.queryElevation (ArcGIS built-in)
      if (!batchProcessed && VIEW && VIEW.ground && VIEW.ground.queryElevation) {
        try {
          console.log('Trying VIEW.ground.queryElevation for batch of', batch.length, 'points')
          
          const pointGeometries = batch.map(point => new Point({
            x: point.x,
            y: point.y,
            spatialReference: spatialReference || VIEW.spatialReference
          }))
          
          const result = await VIEW.ground.queryElevation(pointGeometries, {
            returnSampleInfo: false
          })
          
          console.log('VIEW.ground.queryElevation result:', result)
          
          if (result && result.geometries && Array.isArray(result.geometries)) {
            batch.forEach((point, index) => {
              const geometry = result.geometries[index]
              let elevation = 0
              
              if (geometry && geometry.z !== undefined && geometry.z !== null) {
                elevation = parseFloat(geometry.z)
              } else if (geometry && geometry.hasZ && geometry.z !== undefined) {
                elevation = parseFloat(geometry.z)
              }
              
              allPointsWithElevation.push({
                ...point,
                longitude: point.x,
                latitude: point.y,
                elevation: elevation
              })
            })
            batchProcessed = true
            console.log('Successfully got elevation from VIEW.ground.queryElevation')
          }
        } catch (err) {
          console.warn('VIEW.ground.queryElevation error:', err)
        }
      }

      // Phương pháp 2: Thử Open Elevation API
      if (!batchProcessed) {
        try {
          const locations = batch.map(point => ({
            latitude: point.y,
            longitude: point.x
          }))

          console.log('Trying Open Elevation API for batch of', batch.length, 'points')
          console.log('Sample locations:', locations.slice(0, 3))
          
          const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              locations: locations
            })
          })

          console.log('Open Elevation API response status:', response.status, response.statusText)

          if (response.ok) {
            const data = await response.json()
            console.log('Open Elevation API response data:', data)
            console.log('Response results count:', data.results ? data.results.length : 0)
            console.log('Expected batch count:', batch.length)
            
            if (data.results && Array.isArray(data.results) && data.results.length === batch.length) {
              batch.forEach((point, index) => {
                const result = data.results[index]
                console.log(`Point ${index + 1} result:`, result)
                
                const elevation = result && result.elevation !== undefined && result.elevation !== null
                  ? parseFloat(result.elevation) 
                  : 0
                
                console.log(`Point ${index + 1} elevation:`, elevation)
                
                allPointsWithElevation.push({
                  ...point,
                  longitude: point.x,
                  latitude: point.y,
                  elevation: elevation
                })
              })
              batchProcessed = true
              console.log('Successfully got elevation from Open Elevation API')
            } else {
              console.warn('Open Elevation API response format mismatch:', {
                hasResults: !!data.results,
                resultsLength: data.results ? data.results.length : 0,
                expectedLength: batch.length
              })
            }
          } else {
            const errorText = await response.text()
            console.warn('Open Elevation API failed:', response.status, errorText)
          }
        } catch (err) {
          console.warn('Open Elevation API error:', err)
          console.warn('Error details:', err.message, err.stack)
        }
      }

      // Phương pháp 2: Thử 3D Elevation API (alternative)
      if (!batchProcessed) {
        try {
          console.log('Trying 3D Elevation API for batch of', batch.length, 'points')
          
          // Sử dụng elevation-api.io
          const locations = batch.map(point => `${point.y},${point.x}`).join('|')
          const response = await fetch(`https://api.elevation-api.com/api/v1/lookup?locations=${encodeURIComponent(locations)}`)
          
          if (response.ok) {
            const data = await response.json()
            console.log('3D Elevation API response:', data)
            
            if (data.results && Array.isArray(data.results)) {
              batch.forEach((point, index) => {
                const result = data.results[index]
                const elevation = result && result.elevation !== undefined && result.elevation !== null
                  ? parseFloat(result.elevation) 
                  : 0
                
                allPointsWithElevation.push({
                  ...point,
                  longitude: point.x,
                  latitude: point.y,
                  elevation: elevation
                })
              })
              batchProcessed = true
              console.log('Successfully got elevation from 3D Elevation API')
            }
          }
        } catch (err) {
          console.warn('3D Elevation API error:', err)
        }
      }

      // Phương pháp 3: Thử ArcGIS REST API với query
      if (!batchProcessed) {
        try {
          console.log('Trying ArcGIS REST API query for batch of', batch.length, 'points')
          
          const elevationServiceUrl = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
          
          // Tạo geometries array cho query
          const geometries = batch.map(point => ({
            x: point.x,
            y: point.y,
            spatialReference: spatialReference || { wkid: 4326 }
          }))
          
          // Sử dụng REST API query trực tiếp
          const queryUrl = `${elevationServiceUrl}/query`
          const params = new URLSearchParams({
            f: 'json',
            geometries: JSON.stringify(geometries),
            geometryType: 'esriGeometryPoint',
            returnSampleInfo: 'false',
            returnGeometry: 'true'
          })
          
          const response = await fetch(queryUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('ArcGIS REST API query result:', data)
            
            if (data.geometries && Array.isArray(data.geometries)) {
              batch.forEach((point, index) => {
                const geometry = data.geometries[index]
                let elevation = 0
                
                if (geometry && geometry.z !== undefined && geometry.z !== null) {
                  elevation = parseFloat(geometry.z)
                } else if (geometry && geometry.hasZ && geometry.z !== undefined) {
                  elevation = parseFloat(geometry.z)
                }
                
                allPointsWithElevation.push({
                  ...point,
                  longitude: point.x,
                  latitude: point.y,
                  elevation: elevation
                })
              })
              batchProcessed = true
              console.log('Successfully got elevation from ArcGIS REST API query')
            }
          } else {
            const errorText = await response.text()
            console.warn('ArcGIS REST API query failed:', response.status, errorText)
          }
        } catch (err) {
          console.warn('ArcGIS REST API query error:', err)
        }
      }

      // Phương pháp 4: Thử ArcGIS REST API trực tiếp với identify
      if (!batchProcessed) {
        try {
          console.log('Trying ArcGIS REST API identify for batch of', batch.length, 'points')
          
          const elevationServiceUrl = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
          
          // Query từng điểm một
          const batchResults = await Promise.all(
            batch.map(async (point, index) => {
              try {
                const identifyUrl = `${elevationServiceUrl}/identify`
                const params = new URLSearchParams({
                  f: 'json',
                  geometry: JSON.stringify({
                    x: point.x,
                    y: point.y,
                    spatialReference: spatialReference || { wkid: 4326 }
                  }),
                  geometryType: 'esriGeometryPoint',
                  returnCatalogItems: 'false',
                  returnGeometry: 'false'
                })
                
                const response = await fetch(identifyUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: params
                })

                if (response.ok) {
                  const data = await response.json()
                  console.log(`Point ${index + 1} identify response:`, data)
                  
                  let elevation = 0
                  if (data.value !== undefined && data.value !== null) {
                    elevation = parseFloat(data.value)
                  } else if (data.results && data.results.length > 0 && data.results[0].value !== undefined) {
                    elevation = parseFloat(data.results[0].value)
                  }
                  
                  return {
                    ...point,
                    longitude: point.x,
                    latitude: point.y,
                    elevation: elevation
                  }
                } else {
                  const errorText = await response.text()
                  console.warn(`Point ${index + 1} identify failed:`, response.status, errorText)
                }
              } catch (err) {
                console.warn(`Error querying elevation for point ${index + 1}:`, err)
              }
              
              return {
                ...point,
                longitude: point.x,
                latitude: point.y,
                elevation: 0
              }
            })
          )
          
          allPointsWithElevation.push(...batchResults)
          batchProcessed = true
        } catch (err) {
          console.error('ArcGIS REST API error:', err)
        }
      }

      // Nếu tất cả đều fail, set elevation = 0
      if (!batchProcessed) {
        console.warn('All elevation services failed, setting elevation to 0')
        batch.forEach((point) => {
          allPointsWithElevation.push({
            ...point,
            longitude: point.x,
            latitude: point.y,
            elevation: 0
          })
        })
      }
    }

    // Log kết quả
    const nonZeroElevations = allPointsWithElevation.filter(p => p.elevation !== 0).length
    console.log('Elevation query completed:', {
      total: allPointsWithElevation.length,
      withElevation: nonZeroElevations,
      withoutElevation: allPointsWithElevation.length - nonZeroElevations,
      sample: allPointsWithElevation.slice(0, 5).map(p => ({ 
        lon: p.longitude.toFixed(6), 
        lat: p.latitude.toFixed(6), 
        elev: p.elevation 
      }))
    })

    return allPointsWithElevation
  } catch (error) {
    console.error('Error getting elevation:', error)
    // Trả về points với elevation = 0 nếu có lỗi
    return points.map(point => ({
      ...point,
      longitude: point.x,
      latitude: point.y,
      elevation: 0
    }))
  }
}

// Xuất tọa độ ra file KML
export const exportGridCoordinatesToKML = (coordinates) => {
  try {
    if (!coordinates || coordinates.length === 0) {
      window.alert('Không có dữ liệu để xuất KML')
      return
    }

    console.log('Bắt đầu xuất KML với', coordinates.length, 'điểm')

    // Tạo XML document cho KML
    let doc = $.parseXML(
    `<?xml version="1.0" encoding="utf-8"?>
    <kml xmlns:atom="http://www.w3.org/2005/Atom" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>Lưới điểm đo</name>
        <description>Xuất từ hệ thống lưới điểm cách nhau 5m</description>
        <Style id="grid-point-style">
          <IconStyle>
            <scale>1.1</scale>
            <color>ff00ff00</color>
            <Icon>
              <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
            </Icon>
          </IconStyle>
          <LabelStyle>
            <scale>0.8</scale>
          </LabelStyle>
        </Style>
        <Style id="grid-point-start">
          <IconStyle>
            <scale>1.3</scale>
            <color>ff00ff00</color>
            <Icon>
              <href>http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png</href>
            </Icon>
          </IconStyle>
        </Style>
        <Style id="grid-point-end">
          <IconStyle>
            <scale>1.3</scale>
            <color>ff0000ff</color>
            <Icon>
              <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
            </Icon>
          </IconStyle>
        </Style>
      </Document>
    </kml>`
  )

  let root_xml = doc.getElementsByTagName('kml')[0]
  let xml = doc.getElementsByTagName('Document')[0]

  // Tạo Folder cho các điểm lưới
  let folder = doc.createElement('Folder')
  let folderName = doc.createElement('name')
  $(folderName).text('Điểm lưới')
  folder.appendChild(folderName)

  // Tạo Placemark cho mỗi điểm
  coordinates.forEach((coord, index) => {
    let placemark = doc.createElement('Placemark')
    
    // Tên điểm
    let name = doc.createElement('name')
    const row = coord.row !== undefined ? coord.row : ''
    const col = coord.col !== undefined ? coord.col : ''
    const type = coord.isStart ? 'Điểm đầu' : coord.isEnd ? 'Điểm cuối' : `Điểm [${row},${col}]`
    $(name).text(type)
    placemark.appendChild(name)

    // Mô tả
    let description = doc.createElement('description')
    const pointType = coord.isStart ? 'Điểm đầu' : coord.isEnd ? 'Điểm cuối' : coord.isCorner ? 'Góc' : coord.isEdge ? 'Cạnh' : 'Trong lưới'
    let descText = `<table>
      <tr><td><b>Row:</b></td><td>${row}</td></tr>
      <tr><td><b>Col:</b></td><td>${col}</td></tr>
      <tr><td><b>Kinh độ:</b></td><td>${coord.longitude.toFixed(6)}</td></tr>
      <tr><td><b>Vĩ độ:</b></td><td>${coord.latitude.toFixed(6)}</td></tr>
      <tr><td><b>Cao độ:</b></td><td>${coord.elevation !== undefined ? coord.elevation.toFixed(2) : '0'} m</td></tr>
      <tr><td><b>Loại điểm:</b></td><td>${pointType}</td></tr>
    </table>`
    // Sử dụng createCDATASection để tạo CDATA
    let cdata = doc.createCDATASection(descText)
    description.appendChild(cdata)
    placemark.appendChild(description)

    // Style URL
    let styleUrl = doc.createElement('styleUrl')
    if (coord.isStart) {
      $(styleUrl).text('#grid-point-start')
    } else if (coord.isEnd) {
      $(styleUrl).text('#grid-point-end')
    } else {
      $(styleUrl).text('#grid-point-style')
    }
    placemark.appendChild(styleUrl)

    // Point coordinates với cao độ
    let point = doc.createElement('Point')
    let coordinates_elem = doc.createElement('coordinates')
    // Format: longitude,latitude,elevation (elevation là bắt buộc trong KML)
    // Đảm bảo elevation luôn có giá trị (mặc định là 0 nếu không có)
    const elevation = (coord.elevation !== undefined && coord.elevation !== null) 
      ? parseFloat(coord.elevation) 
      : 0
    // KML yêu cầu format: longitude,latitude,elevation
    $(coordinates_elem).text(`${coord.longitude},${coord.latitude},${elevation}`)
    point.appendChild(coordinates_elem)
    placemark.appendChild(point)

    folder.appendChild(placemark)
  })

  // Thêm folder vào Document
  xml.appendChild(folder)
  root_xml.appendChild(xml)

    // Tạo và download file KML
    const filename = `grid_coordinates_${new Date().getTime()}.kml`
    const kmlContent = '<?xml version="1.0" encoding="utf-8"?>' + root_xml.outerHTML
    const blob = new Blob(
      [kmlContent],
      { type: 'application/vnd.google-earth.kml+xml' }
    )
    
    const link = document.createElement('a')
    const url = window.URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Giải phóng URL object sau khi download
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 100)

    // Hiển thị thông báo thành công
    console.log('Đã xuất KML thành công:', filename)
    window.alert(`Đã xuất ${coordinates.length} điểm lưới ra file KML thành công!\n\nFile: ${filename}`)
  } catch (error) {
    console.error('Lỗi khi xuất KML:', error)
    window.alert(`Có lỗi xảy ra khi xuất file KML:\n${error.message}\n\nVui lòng thử lại.`)
  }
}
