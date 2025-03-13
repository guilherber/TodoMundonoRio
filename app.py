from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import json

app = FastAPI(title="Lady Gaga Show Map API")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Diretório onde os arquivos GeoJSON estão armazenados
GEOJSON_DIR = "geojson"

# Rota raiz - redirecionar para index.html
@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/api/geojson/{layer_name}")
async def get_geojson(layer_name: str):
    """
    Retorna dados GeoJSON para a camada especificada
    """
    # Sanitizar o nome da camada para evitar navegação de diretório
    layer_name = os.path.basename(layer_name)
    
    # Construir o caminho do arquivo
    file_path = os.path.join(GEOJSON_DIR, f"{layer_name}.geojson")
    
    # Verificar se o arquivo existe
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Arquivo GeoJSON para '{layer_name}' não encontrado")
    
    try:
        # Ler o arquivo GeoJSON
        with open(file_path, 'r', encoding='utf-8') as file:
            geojson_data = json.load(file)
        
        return geojson_data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Arquivo '{layer_name}.geojson' não é um JSON válido")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar arquivo: {str(e)}")

@app.get("/api/layers")
async def get_available_layers():
    """
    Retorna a lista de camadas GeoJSON disponíveis
    """
    try:
        # Verificar se o diretório existe
        if not os.path.exists(GEOJSON_DIR):
            return {"layers": []}
        
        # Listar todos os arquivos GeoJSON no diretório
        layers = []
        for filename in os.listdir(GEOJSON_DIR):
            if filename.endswith('.geojson'):
                layer_name = filename.replace('.geojson', '')
                layers.append({
                    "name": layer_name,
                    "url": f"/api/geojson/{layer_name}"
                })
        
        return {"layers": layers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar camadas: {str(e)}")

# Montar os arquivos estáticos DEPOIS das outras rotas
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)