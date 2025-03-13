document.addEventListener('DOMContentLoaded', async function() {
    // Chave da API do OpenWeatherMap
    const OPENWEATHER_API_KEY = '0acbbf2a7e9e0c157c4e02f13835378b';

    // Função para buscar previsão do tempo para um ponto
    async function fetchWeatherForPoint(latitude, longitude) {
        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=pt_br`);
            
            if (!response.ok) {
                throw new Error('Falha ao buscar previsão do tempo');
            }
            
            const weatherData = await response.json();
            
            // Criar conteúdo do popup com informações meteorológicas
            return `
                <div class="weather-popup">
                    <h3>Previsão do Tempo</h3>
                    <img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="Ícone do tempo" style="width: 80px; display: block; margin: 0 auto;">
                    <p><strong>Temperatura:</strong> ${weatherData.main.temp.toFixed(1)}°C</p>
                    <p><strong>Sensação Térmica:</strong> ${weatherData.main.feels_like.toFixed(1)}°C</p>
                    <p><strong>Umidade:</strong> ${weatherData.main.humidity}%</p>
                    <p><strong>Condição:</strong> ${weatherData.weather[0].description}</p>
                    <p><strong>Vento:</strong> ${weatherData.wind.speed.toFixed(1)} m/s</p>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao buscar previsão do tempo:', error);
            return `<div class="weather-popup">Previsão indisponível</div>`;
        }
    }

    // Inicializar o mapa
    const map = L.map('map', {
        center: [-22.9671, -43.1844], // Latitude, Longitude de Copacabana
        zoom: 15,
        zoomControl: false
    });
    
    // Adicionar camada base escura
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    // Adicionar controle de zoom personalizado
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);
    
    // Criar grupos de camadas para cada categoria
    const layers = {
        show: L.layerGroup().addTo(map),
        security: L.layerGroup(),
        transport: L.layerGroup(),
        blocks: L.layerGroup(),
        services: L.layerGroup(),
        hotels: L.layerGroup(),
        restaurants: L.layerGroup(),
        weather: L.layerGroup() // Nova camada para pontos de previsão
    };
    
    // Mapear nomes de camadas para categorias
    const layerCategories = {
        "areabloqueada": "blocks",
        "palco": "show", 
        "metros": "transport",
        "metro": "transport", // Adicionando 'metro' como alternativa
        "servicos": "services",
        "hoteis": "hotels",
        "posto": "security",  // Adicionando categoria para postos
        "postos": "security",
        "weather": "weather" // Nova categoria para pontos de clima
    };
    
    // Cores para cada camada
    const layerColors = {
        "areabloqueada": "#D33131",
        "palco": "#EBBC00",
        "metros": "#28A745",  // Verde para metro
        "metro": "#28A745",   // Verde para metro
        "servicos": "#A67C00",
        "hoteis": "#9013FE",
        "posto": "#0000FF",   // Azul para segurança
        "postos": "#0000FF",  // Azul para segurança
        "weather": "#87CEFA", // Azul claro para pontos de clima
        "default": "#EBBC00"
    };
    
    // Carregar as camadas disponíveis da API
    async function loadAvailableLayers() {
        try {
            // Obter lista de camadas da API
            console.log("Buscando lista de camadas disponíveis da API...");
            const response = await fetch('/api/layers');
            if (!response.ok) {
                throw new Error(`Erro ao obter camadas: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Camadas disponíveis:", data);
            
            if (!data.layers || data.layers.length === 0) {
                console.warn("Nenhuma camada encontrada na API");
                return [];
            }
            
            return data.layers;
        } catch (error) {
            console.error("Erro ao carregar lista de camadas:", error);
            // Fallback para lista predefinida se a API falhar
            return [
                { name: "areabloqueada", url: "/api/geojson/areabloqueada" },
                { name: "metros", url: "/api/geojson/metros" },
                { name: "postos", url: "/api/geojson/postos" }
            ];
        }
    }
    
    // Carregar uma camada específica da API
    async function loadLayerFromAPI(layerInfo) {
        try {
            console.log(`Carregando camada ${layerInfo.name} da API...`);
            
            // Fazer requisição à API
            const response = await fetch(layerInfo.url);
            if (!response.ok) {
                throw new Error(`Erro ao carregar ${layerInfo.name}: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Dados da camada ${layerInfo.name}:`, data);
            
            // Verificar se os dados são válidos
            if (!data.type || !data.features) {
                console.warn(`Dados inválidos para camada ${layerInfo.name}`);
                return false;
            }
            
            // Determinar a categoria da camada
            const layerNameLower = layerInfo.name.toLowerCase();
            const category = layerCategories[layerNameLower] || "show";
            
            // Verificar se há pontos na coleção
            const hasPoints = data.features.some(f => 
                f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')
            );
            
            // Criar camada Leaflet
            let geoJSONLayer;
            
            if (hasPoints) {
                console.log(`Camada ${layerInfo.name} contém pontos, será renderizada como círculos`);
                geoJSONLayer = L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => {
                        // Determinar a cor correta para o ponto
                        const pointColor = layerColors[layerNameLower] || layerColors.default;
                        
                        // Criar um círculo marcador para o ponto
                        return L.circleMarker(latlng, {
                            radius: 8,
                            color: '#fff',
                            weight: 1.5,
                            fillColor: pointColor,
                            fillOpacity: 0.9
                        });
                    },
                    onEachFeature: async (feature, layer) => {
                        // Criar conteúdo inicial do popup
                        let content = `<strong>${feature.properties.name || layerInfo.name}</strong>`;
                        
                        // Se for um ponto e for da camada de weather, buscar previsão
                        if (feature.geometry.type === 'Point' && layerNameLower === 'weather') {
                            const [longitude, latitude] = feature.geometry.coordinates;
                            
                            try {
                                // Adicionar previsão do tempo ao popup
                                const weatherContent = await fetchWeatherForPoint(latitude, longitude);
                                content += weatherContent;
                            } catch (error) {
                                console.error('Erro ao adicionar previsão:', error);
                                content += '<p>Previsão indisponível</p>';
                            }
                        }
                        
                        // Adicionar outras propriedades relevantes
                        if (feature.properties) {
                            // Excluir propriedades que já mostramos ou que são técnicas
                            const excludeProps = ['name', 'id', 'crs', 'type'];
                            const otherProps = Object.entries(feature.properties)
                                .filter(([key]) => !excludeProps.includes(key));
                            
                            if (otherProps.length > 0) {
                                content += '<hr>';
                                otherProps.forEach(([key, value]) => {
                                    if (value !== null && value !== undefined && value !== '') {
                                        content += `<b>${key}:</b> ${value}<br>`;
                                    }
                                });
                            }
                        }
                        
                        layer.bindPopup(content);
                    }
                });
            } else {
                console.log(`Camada ${layerInfo.name} contém polígonos`);
                // Definir estilo da camada
                const style = {
                    color: layerColors[layerNameLower] || layerColors.default,
                    fillColor: layerColors[layerNameLower] || layerColors.default,
                    weight: 1.5,
                    opacity: 0.7,
                    fillOpacity: 0.2
                };
                
                geoJSONLayer = L.geoJSON(data, {
                    style: style,
                    onEachFeature: (feature, layer) => {
                        // Criar popup para o polígono
                        let content = `<strong>${feature.properties.name || layerInfo.name}</strong>`;
                        if (feature.properties) {
                            // Filtrar apenas propriedades úteis
                            const propsToShow = Object.entries(feature.properties)
                                .filter(([key, value]) => {
                                    // Excluir propriedades técnicas ou vazias
                                    return !['id', 'crs', 'type'].includes(key.toLowerCase()) && 
                                           value !== null && value !== undefined && value !== '';
                                });
                            
                            if (propsToShow.length > 0) {
                                content += '<hr>';
                                propsToShow.forEach(([key, value]) => {
                                    content += `<b>${key}:</b> ${value}<br>`;
                                });
                            }
                        }
                        
                        layer.bindPopup(content);
                    }
                });
            }
            
            // Verificar se a camada foi criada corretamente
            if (!geoJSONLayer || geoJSONLayer.getLayers().length === 0) {
                console.warn(`Camada ${layerInfo.name} criada, mas sem features visíveis`);
                return false;
            }
            
            // Adicionar ao grupo de camadas correspondente
            geoJSONLayer.addTo(layers[category]);
            console.log(`Camada ${layerInfo.name} adicionada à categoria ${category} com ${geoJSONLayer.getLayers().length} features`);
            
            // Tentar ajustar visualização
            try {
                const bounds = geoJSONLayer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds);
                    console.log(`Mapa ajustado para os limites da camada ${layerInfo.name}`);
                }
            } catch (e) {
                console.warn(`Erro ao ajustar visualização para ${layerInfo.name}:`, e);
            }
            
            return true;
        } catch (error) {
            console.error(`Erro ao carregar camada ${layerInfo.name}:`, error);
            return false;
        }
    }
    
    // Carregar todas as camadas
    async function loadAllLayers() {
        // Obter lista de camadas disponíveis
        const availableLayers = await loadAvailableLayers();
        
        // Adicionar camada de pontos de clima manualmente, se não existir
        if (!availableLayers.some(layer => layer.name.toLowerCase() === 'weather')) {
            availableLayers.push({
                name: 'weather',
                url: `/api/geojson/weather` // Ajuste a URL conforme necessário
            });
        }
        
        // Carregar cada camada
        let loadedCount = 0;
        for (const layer of availableLayers) {
            const success = await loadLayerFromAPI(layer);
            if (success) loadedCount++;
        }
        
        console.log(`Carregadas ${loadedCount} de ${availableLayers.length} camadas`);
        
        // Ajustar visualização final
        setTimeout(() => {
            try {
                // Verificar se há alguma camada visível
                const visibleLayers = Object.values(layers)
                    .flatMap(group => group.getLayers())
                    .filter(layer => map.hasLayer(layer));
                
                if (visibleLayers.length > 0) {
                    // Criar um featureGroup com todas as camadas visíveis
                    const allFeaturesGroup = L.featureGroup(visibleLayers);
                    const bounds = allFeaturesGroup.getBounds();
                    
                    if (bounds.isValid()) {
                        map.fitBounds(bounds);
                        console.log("Mapa ajustado para mostrar todas as camadas");
                    } else {
                        console.log("Limites inválidos, mantendo visualização padrão");
                        map.setView([-22.9671, -43.1844], 15);
                    }
                } else {
                    console.log("Nenhuma camada visível, mantendo visualização padrão");
                    map.setView([-22.9671, -43.1844], 15);
                }
            } catch (e) {
                console.warn("Erro ao ajustar visualização do mapa:", e);
                map.setView([-22.9671, -43.1844], 15);
            }
        }, 500);
    }
    
    // Função para alternar entre as camadas
    function toggleLayer(category) {
        // Remover todas as camadas
        Object.values(layers).forEach(layer => {
            map.removeLayer(layer);
        });
        
        // Ativar o botão correspondente
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        
        // Adicionar todas as camadas se a categoria for 'all'
        if (category === 'all') {
            Object.values(layers).forEach(layer => {
                map.addLayer(layer);
            });
            return;
        }
        
        // Adicionar apenas a camada selecionada
        map.addLayer(layers[category]);
        
        // Log para depuração das camadas visíveis
        console.log(`Camada ${category} ativada. Número de features: ${layers[category].getLayers().length}`);
    }
    
    // Adicionar eventos aos botões
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleLayer(btn.dataset.category);
        });
    });
    
    // Botão para mostrar a localização do usuário
    document.querySelector('.location-btn')?.addEventListener('click', () => {
        map.locate({setView: true, maxZoom: 17});
    });
    
    // Ao encontrar localização
    map.on('locationfound', e => {
        const userMarker = L.circleMarker(e.latlng, {
            radius: 8,
            color: '#fff',
            weight: 2,
            fillColor: '#4285F4',
            fillOpacity: 0.8
        }).addTo(map).bindPopup('Você está aqui').openPopup();
        
        // Remover o marcador após 30 segundos
        setTimeout(() => {
            map.removeLayer(userMarker);
        }, 30000);
    });
    
    // Lidar com erros na localização
    map.on('locationerror', e => {
        alert("Não foi possível acessar sua localização. Verifique se você permitiu o acesso à localização no seu navegador.");
    });
    
    // Eventos para abrir e fechar o painel de controle
    document.querySelector('.control-close')?.addEventListener('click', () => {
        document.querySelector('.control-panel').classList.add('hidden');
        document.querySelector('.menu-toggle').classList.remove('hidden');
    });
    
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
        document.querySelector('.control-panel').classList.remove('hidden');
        document.querySelector('.menu-toggle').classList.add('hidden');
    });
    
    // Eventos para minimizar o painel de informações
    document.querySelector('.info-close')?.addEventListener('click', (e) => {
        e.preventDefault();
        
        const infoPanel = document.querySelector('.info-panel');
        if (infoPanel.style.height !== '40px') {
            infoPanel.style.height = '40px';
            infoPanel.style.overflow = 'hidden';
            document.querySelector('.info-close').innerHTML = '&#9660;';
        } else {
            infoPanel.style.height = '';
            infoPanel.style.overflow = '';
            document.querySelector('.info-close').innerHTML = '&times;';
        }
    });
    
    // Modal Como Chegar
    document.querySelector('.como-chegar-btn')?.addEventListener('click', () => {
        document.querySelector('.como-chegar-modal').classList.remove('hidden');
        document.querySelector('.overlay').classList.remove('hidden');
    });
    
    document.querySelector('.modal-close')?.addEventListener('click', () => {
        document.querySelector('.como-chegar-modal').classList.add('hidden');
        document.querySelector('.overlay').classList.add('hidden');
    });
    
    document.querySelector('.overlay')?.addEventListener('click', () => {
        document.querySelector('.como-chegar-modal').classList.add('hidden');
        document.querySelector('.overlay').classList.add('hidden');
    });
    
    // Botão de rota no modal
    document.querySelector('.route-btn')?.addEventListener('click', () => {
        document.querySelector('.como-chegar-modal').classList.add('hidden');
        document.querySelector('.overlay').classList.add('hidden');
        
        toggleLayer('transport');
        
        // Procurar pela estação Siqueira Campos em todas as camadas de transporte
        let foundSiqueiraCampos = false;
        layers.transport.eachLayer(layer => {
            layer.eachLayer && layer.eachLayer(subLayer => {
                if (subLayer.feature && 
                    subLayer.feature.properties && 
                    subLayer.feature.properties.name && 
                    subLayer.feature.properties.name.includes('Siqueira Campos')) {
                    
                    // Centralizar o mapa na estação
                    if (subLayer.getLatLng) {
                        map.setView(subLayer.getLatLng(), 16);
                        subLayer.openPopup();
                        foundSiqueiraCampos = true;
                    }
                }
            });
            
            // Se não encontrou nas subcamadas, verificar na camada diretamente
            if (!foundSiqueiraCampos && layer.feature && 
                layer.feature.properties && 
                layer.feature.properties.name && 
                layer.feature.properties.name.includes('Siqueira Campos')) {
                
                // Centralizar o mapa na estação
                if (layer.getLatLng) {
                    map.setView(layer.getLatLng(), 16);
                    layer.openPopup();
                    foundSiqueiraCampos = true;
                }
            }
        });
        
        if (!foundSiqueiraCampos) {
            console.warn("Estação Siqueira Campos não encontrada");
            
            // Centralizar em Copacabana como fallback
            map.setView([-22.9671, -43.1844], 15);
        }
    });
    
    // Carregamento inicial
    await loadAllLayers();
    
    // Inicializar com a camada 'blocks' visível por padrão
    toggleLayer('blocks');
    
    console.log("Mapa inicializado com sucesso");
});
// Adicione este código ao seu arquivo script.js existente

// Função para preencher o painel de previsão do tempo
async function updateWeatherPanel() {
    // Coordenadas de Copacabana, Rio de Janeiro
    const lat = -22.9671;
    const lon = -43.1844;
    
    try {
        // Usar a mesma chave de API que já está definida no script
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${'0acbbf2a7e9e0c157c4e02f13835378b'}`);
        if (!response.ok) {
            throw new Error('Falha ao buscar previsão do tempo');
        }
        
        const weatherData = await response.json();
        
        // Atualizar os elementos no painel
        document.getElementById('weather-temp').textContent = `${Math.round(weatherData.main.temp)}°C`;
        document.getElementById('weather-sky').textContent = weatherData.weather[0].description.charAt(0).toUpperCase() + weatherData.weather[0].description.slice(1);
        
        // Para chance de chuva, usar cobertura de nuvens como aproximação, ou o pop se disponível
        const rainChance = weatherData.clouds ? weatherData.clouds.all : 0;
        document.getElementById('weather-rain').textContent = `${rainChance}%`;
        
        // Formatar a velocidade do vento
        const windSpeed = weatherData.wind.speed;
        let windDescription = 'Fraco';
        
        if (windSpeed > 10) {
            windDescription = 'Forte';
        } else if (windSpeed > 5) {
            windDescription = 'Moderado';
        }
        
        document.getElementById('weather-wind').textContent = `${windDescription}, ${Math.round(windSpeed * 3.6)} km/h`; // Convertendo m/s para km/h
        
        // Adicionar ícone do clima
        const iconContainer = document.getElementById('weather-icon-container');
        iconContainer.innerHTML = `<img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="Ícone do tempo" style="width: 80px; height: 80px;">`;
        
    } catch (error) {
        console.error('Erro ao atualizar painel de previsão do tempo:', error);
        document.getElementById('weather-temp').textContent = 'Erro ao carregar';
        document.getElementById('weather-sky').textContent = 'Erro ao carregar';
        document.getElementById('weather-rain').textContent = 'Erro ao carregar';
        document.getElementById('weather-wind').textContent = 'Erro ao carregar';
    }
}

// Adicionar este evento ao seu DOMContentLoaded existente
document.addEventListener('DOMContentLoaded', function() {
    // Chamar a função de atualização do clima
    updateWeatherPanel();
    
    // Configurar a atualização periódica (a cada 30 minutos)
    setInterval(updateWeatherPanel, 30 * 60 * 1000);
    
    // Adicionar evento para abrir/fechar o painel do clima
    document.querySelector('.weather-close')?.addEventListener('click', () => {
        const weatherPanel = document.querySelector('.weather-panel');
        if (weatherPanel.style.height !== '40px') {
            weatherPanel.style.height = '40px';
            weatherPanel.style.overflow = 'hidden';
            document.querySelector('.weather-close').innerHTML = '&#9660;';
        } else {
            weatherPanel.style.height = '';
            weatherPanel.style.overflow = '';
            document.querySelector('.weather-close').innerHTML = '&times;';
        }
    });
});