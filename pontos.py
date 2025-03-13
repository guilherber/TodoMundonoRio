import geopandas as gpd
import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import Point, Polygon

def create_grid_points_in_polygon(geojson_path, grid_spacing):
    # Ler o GeoJSON
    gdf = gpd.read_file(geojson_path)
    
    # Pegar o primeiro polígono (assumindo que você quer o primeiro)
    polygon = gdf.geometry.iloc[0]
    
    # Obter os limites do polígono
    minx, miny, maxx, maxy = polygon.bounds
    
    # Criar uma grade de pontos com uma abordagem mais robusta
    points_inside = []
    
    # Usar np.linspace para distribuição mais uniforme
    x_coords = np.linspace(minx, maxx, num=int((maxx-minx)/grid_spacing)+1)
    y_coords = np.linspace(miny, maxy, num=int((maxy-miny)/grid_spacing)+1)
    
    # Verificar quais pontos estão dentro do polígono
    for x in x_coords:
        for y in y_coords:
            point = Point(x, y)
            if polygon.contains(point):
                points_inside.append(point)
    
    # Criar um GeoDataFrame com os pontos
    points_gdf = gpd.GeoDataFrame(geometry=points_inside)
    
    return points_gdf

# Caminho para o seu arquivo GeoJSON
geojson_path = r'C:\Users\Guilherme\Desktop\Gagaproject\geojson\areabloqueada.geojson'

# Espaçamento menor para mais pontos
grid_spacing = 0.0005  # Ajuste este valor para controlar a densidade dos pontos

# Criar pontos dentro do polígono
grid_points = create_grid_points_in_polygon(geojson_path, grid_spacing)

# Salvar os pontos em um novo GeoJSON
grid_points.to_file('pontos_grid.geojson', driver='GeoJSON')

# Visualizar
gdf = gpd.read_file(geojson_path)
fig, ax = plt.subplots(figsize=(10, 10))
gdf.plot(ax=ax, facecolor='none', edgecolor='red')
grid_points.plot(ax=ax, color='blue', markersize=2)
plt.title('Pontos dentro do Polígono')
plt.xlabel('Longitude')
plt.ylabel('Latitude')
plt.show()

# Imprimir número de pontos
print(f"Número de pontos gerados: {len(grid_points)}")