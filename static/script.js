document.addEventListener('DOMContentLoaded', async function() {
    // Chave da API do OpenWeatherMap
    const OPENWEATHER_API_KEY = '0acbbf2a7e9e0c157c4e02f13835378b';
    
    // Verificar se estamos em um dispositivo móvel
    const isMobile = window.innerWidth <= 768;
    console.log('Dispositivo móvel detectado:', isMobile);

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
    window.toggleLayer = function(category) {
        // Remove all layers
        Object.values(layers).forEach(layer => {
            map.removeLayer(layer);
        });
        
        // Activate the corresponding button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        
        // Add all layers if category is 'all', but in correct order
        if (category === 'all') {
            // Add layers in specific z-index order
            const layerOrder = [
                'blocks',     // Bottom layer (areas like areabloqueada)
                'show',       // Mid layers
                'transport',
                'services',
                'hotels',
                'restaurants',
                'security',   // Top layers (points)
                'weather'
            ];
            
            layerOrder.forEach(layerName => {
                map.addLayer(layers[layerName]);
            });
            
            return;
        }
        
        // Special handling for certain categories
        if (category === 'security' || category === 'transport' || 
            category === 'services' || category === 'hotels' || 
            category === 'restaurants' || category === 'weather') {
            // For point-based categories, still show blocks layer but with very low opacity
            const blocksLayer = layers.blocks;
            // Temporarily reduce opacity even further for all features in the blocks layer
            blocksLayer.eachLayer(layer => {
                if (layer.setStyle) {
                    const currentStyle = layer.options || {};
                    layer.setStyle({
                        fillOpacity: 0.05,
                        opacity: 0.3
                    });
                }
            });
            map.addLayer(blocksLayer);
        }
        
        // Add the selected layer (on top)
        map.addLayer(layers[category]);
        
        console.log(`Layer ${category} activated. Number of features: ${layers[category].getLayers().length}`);
    };
        
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
    };
    
    // Função para atualizar o painel de previsão do tempo
    async function updateWeatherPanel() {
        // Coordenadas de Copacabana, Rio de Janeiro
        const lat = -22.9671;
        const lon = -43.1844;
        
        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${OPENWEATHER_API_KEY}`);
            
            if (!response.ok) {
                throw new Error('Falha ao buscar previsão do tempo');
            }
            
            const weatherData = await response.json();
            
            console.log('Dados do clima obtidos:', weatherData);
            
            // Atualizar os elementos do painel
            document.getElementById('weather-temp').textContent = `${Math.round(weatherData.main.temp)}°C`;
            document.getElementById('weather-sky').textContent = weatherData.weather[0].description.charAt(0).toUpperCase() + weatherData.weather[0].description.slice(1);
            
            // Para chance de chuva, usar cobertura de nuvens como aproximação
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
            
            document.getElementById('weather-wind').textContent = `${windDescription}, ${Math.round(windSpeed * 3.6)} km/h`;
            
            // Adicionar ícone do clima
            const iconContainer = document.getElementById('weather-icon-container');
            iconContainer.innerHTML = `<img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="Ícone do tempo" style="width: 80px; height: 80px;">`;
            
        } catch (error) {
            console.error('Erro ao atualizar painel de previsão do tempo:', error);
            
            // Mensagens de erro para os elementos
            document.getElementById('weather-temp').textContent = 'Erro';
            document.getElementById('weather-sky').textContent = 'Indisponível';
            document.getElementById('weather-rain').textContent = 'Indisponível';
            document.getElementById('weather-wind').textContent = 'Indisponível';
        }
    }

    // ===== Configuração de eventos UI =====
    
    // Referências de elementos UI
    const controlPanel = document.querySelector('.control-panel');
    const infoPanel = document.querySelector('.info-panel');
    const weatherPanel = document.querySelector('.weather-panel');
    const menuToggle = document.querySelector('.menu-toggle');
    const infoToggle = document.querySelector('.info-toggle');
    const weatherToggle = document.querySelector('.weather-toggle');
    const comoChegarbtn = document.querySelector('.como-chegar-btn');
    const comoChegarmModal = document.querySelector('.como-chegar-modal');
    const overlay = document.querySelector('.overlay');
    const allCloseButtons = document.querySelectorAll('.control-close, .info-close, .weather-close, .modal-close');
    
    // Função para fechar todos os painéis
    function closeAllPanels() {
        controlPanel.classList.remove('active');
        infoPanel.classList.remove('active');
        weatherPanel.classList.remove('active');
        comoChegarmModal.classList.add('hidden');
        overlay.classList.add('hidden');
        
        // Mostrar botões toggle quando os painéis estão fechados
        menuToggle.classList.remove('hidden');
        infoToggle.classList.remove('hidden');
    }
    
    // Eventos para botões de toggle dos painéis
    if (menuToggle && controlPanel) {
        menuToggle.addEventListener('click', function() {
            weatherPanel.classList.remove('active');
            infoPanel.classList.remove('active');
            comoChegarmModal.classList.add('hidden');
            
            controlPanel.classList.add('active');
            menuToggle.classList.add('hidden');
            overlay.classList.remove('hidden');
            console.log('Menu toggle clicado');
        });
    }
    
    if (infoToggle && infoPanel) {
        infoToggle.addEventListener('click', function() {
            weatherPanel.classList.remove('active');
            controlPanel.classList.remove('active');
            comoChegarmModal.classList.add('hidden');
            
            infoPanel.classList.add('active');
            infoToggle.classList.add('hidden');
            overlay.classList.remove('hidden');
            console.log('Info toggle clicado');
        });
    }
    
    if (weatherToggle && weatherPanel) {
        weatherToggle.addEventListener('click', function() {
            controlPanel.classList.remove('active');
            infoPanel.classList.remove('active');
            comoChegarmModal.classList.add('hidden');
            
            weatherPanel.classList.toggle('active');
            
            if (weatherPanel.classList.contains('active')) {
                updateWeatherPanel();
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
            console.log('Weather toggle clicado');
        });
    }
    
    // Botões de fechar
    allCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            const panel = this.closest('.control-panel, .info-panel, .weather-panel, .como-chegar-modal');
            
            if (panel) {
                if (panel.classList.contains('control-panel')) {
                    panel.classList.remove('active');
                    menuToggle.classList.remove('hidden');
                } else if (panel.classList.contains('info-panel')) {
                    panel.classList.remove('active');
                    infoToggle.classList.remove('hidden');
                } else if (panel.classList.contains('weather-panel')) {
                    panel.classList.remove('active');
                } else if (panel.classList.contains('como-chegar-modal')) {
                    panel.classList.add('hidden');
                }
                
                overlay.classList.add('hidden');
            }
            console.log('Botão de fechar clicado');
        });
    });
    
    // Botão "Como Chegar"
    if (comoChegarbtn && comoChegarmModal) {
        comoChegarbtn.addEventListener('click', function() {
            closeAllPanels();
            comoChegarmModal.classList.remove('hidden');
            overlay.classList.remove('hidden');
            console.log('Botão Como Chegar clicado');
        });
    }
    
    // Fechar quando clicar no overlay
    if (overlay) {
        overlay.addEventListener('click', function() {
            closeAllPanels();
            console.log('Overlay clicado');
        });
    }
    
    // Botões de categoria
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            toggleLayer(this.dataset.category);
            console.log(`Botão de categoria ${this.dataset.category} clicado`);
            
            if (isMobile) {
                // Em mobile, fecha o painel depois de selecionar uma categoria
                setTimeout(() => {
                    controlPanel.classList.remove('active');
                    menuToggle.classList.remove('hidden');
                    overlay.classList.add('hidden');
                }, 300);
            }
        });
    });
    
    // Botão de localização
    document.querySelector('.location-btn')?.addEventListener('click', function() {
        map.locate({setView: true, maxZoom: 17});
        console.log('Botão de localização clicado');
    });
    
    // Botão "Mostrar rota no mapa" no modal Como Chegar
    document.querySelector('.route-btn')?.addEventListener('click', function() {
        comoChegarmModal.classList.add('hidden');
        overlay.classList.add('hidden');
        
        toggleLayer('transport');
        console.log('Botão de rota clicado');
    });
    
    // Eventos do mapa (localização)
    map.on('locationfound', function(e) {
        const userMarker = L.circleMarker(e.latlng, {
            radius: 8,
            color: '#fff',
            weight: 2,
            fillColor: '#4285F4',
            fillOpacity: 0.8
        }).addTo(map).bindPopup('Você está aqui').openPopup();
        
        setTimeout(() => {
            map.removeLayer(userMarker);
        }, 30000);
        
        console.log('Localização encontrada:', e.latlng);
    });
    
    map.on('locationerror', function(e) {
        alert("Não foi possível acessar sua localização. Verifique se você permitiu o acesso à localização no seu navegador.");
        console.error('Erro de localização:', e);
    });
    
    // Adaptações específicas para mobile
    if (isMobile) {
        // Configuração inicial para mobile - painéis fechados por padrão
        controlPanel.classList.remove('active');
        infoPanel.classList.remove('active');
        weatherPanel.classList.remove('active');
        
        // Mostrar botões toggle
        if (menuToggle) menuToggle.classList.remove('hidden');
        if (infoToggle) infoToggle.classList.remove('hidden');
        
        // Ajustar comportamento de toque
        document.querySelectorAll('.category-btn, .control-close, .info-close, .weather-close, .modal-close, .como-chegar-btn, .route-btn').forEach(btn => {
            btn.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.97)';
            });
            
            btn.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
    }
    
    // Inicialização
    await loadAllLayers();
    updateWeatherPanel();
    toggleLayer('all');  // Camada inicial
    
    // Atualizar dados do clima periodicamente
    setInterval(updateWeatherPanel, 30 * 60 * 1000);  // A cada 30 minutos
    
    console.log('Aplicação inicializada com sucesso');
});
// Adicionar ao arquivo script.js existente ou criar um novo arquivo

document.addEventListener('DOMContentLoaded', function() {
    // Elementos do Todo Mundo na Grade
    const naGradeBtn = document.querySelector('.na-grade-btn');
    const naGradeModal = document.querySelector('.na-grade-modal');
    const naGradeClose = naGradeModal.querySelector('.modal-close');
    const overlay = document.querySelector('.overlay');
    
    // Função para abrir o modal Todo Mundo na Grade
    function openNaGradeModal() {
        naGradeModal.classList.remove('hidden');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Impede o scroll da página
    }
    
    // Função para fechar o modal Todo Mundo na Grade
    function closeNaGradeModal() {
        naGradeModal.classList.add('hidden');
        overlay.classList.add('hidden');
        document.body.style.overflow = ''; // Restaura o scroll da página
    }
    
    // Event listeners para o modal Todo Mundo na Grade
    naGradeBtn.addEventListener('click', openNaGradeModal);
    naGradeClose.addEventListener('click', closeNaGradeModal);
    
    // Fechar o modal ao clicar no overlay
    overlay.addEventListener('click', function() {
        closeNaGradeModal();
        
        // Verificar e fechar outros modais que possam estar abertos
        const comoChegaModal = document.querySelector('.como-chegar-modal');
        if (!comoChegaModal.classList.contains('hidden')) {
            comoChegaModal.classList.add('hidden');
        }
    });
    
    // Fechar o modal ao pressionar a tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeNaGradeModal();
        }
    });
});
// Adicione este código ao final do seu script.js, dentro do escopo do DOMContentLoaded

// Configuração da legenda fixa no mapa
const mapLegend = document.querySelector('.map-legend');
const legendToggle = document.querySelector('.legend-toggle');

if (mapLegend && legendToggle) {
    // Verificar se deve iniciar colapsado em dispositivos móveis
    if (window.innerWidth <= 768) {
        mapLegend.classList.add('collapsed');
    }
    
    // Alternar entre legenda expandida/colapsada
    legendToggle.addEventListener('click', function() {
        mapLegend.classList.toggle('collapsed');
        
        // Salvar preferência do usuário no localStorage
        localStorage.setItem('legendCollapsed', mapLegend.classList.contains('collapsed'));
    });
    
    // Verificar preferência salva
    const savedState = localStorage.getItem('legendCollapsed');
    if (savedState === 'true') {
        mapLegend.classList.add('collapsed');
    } else if (savedState === 'false') {
        mapLegend.classList.remove('collapsed');
    }
    
    // Permitir arrastar a legenda (opcional - para maior flexibilidade)
    let isDragging = false;
    let offsetX, offsetY;
    
    // Iniciar arraste
    mapLegend.addEventListener('mousedown', function(e) {
        if (e.target.closest('.legend-toggle')) return; // Não iniciar arraste se clicar no botão de toggle
        
        isDragging = true;
        offsetX = e.clientX - mapLegend.getBoundingClientRect().left;
        offsetY = e.clientY - mapLegend.getBoundingClientRect().top;
        
        mapLegend.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    // Mover durante arraste
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        // Garantir que a legenda permaneça dentro da janela visível
        const maxX = window.innerWidth - mapLegend.offsetWidth;
        const maxY = window.innerHeight - mapLegend.offsetHeight;
        
        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(0, Math.min(y, maxY));
        
        mapLegend.style.left = boundedX + 'px';
        mapLegend.style.bottom = 'auto';
        mapLegend.style.top = boundedY + 'px';
    });
    
    // Finalizar arraste
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            mapLegend.style.cursor = '';
        }
    });
}
// Dentro do evento DOMContentLoaded existente
document.querySelector('#show-route-btn')?.addEventListener('click', function() {
    const comoChegarmModal = document.querySelector('.como-chegar-modal');
    const overlay = document.querySelector('.overlay');
    comoChegarmModal.classList.add('hidden');
    overlay.classList.add('hidden');

    toggleLayer('transport'); // Exibe a camada de transporte

    // Remover qualquer rota anterior
    if (map.routingControl) {
        map.removeControl(map.routingControl);
    }

    // Obter o tipo de transporte selecionado
    const transportType = document.querySelector('#transport-type').value;

    // Definir destinos predefinidos para cada opção de transporte
    const destinations = {
        'metro': [-22.9680, -43.1815], // Estação Siqueira Campos (aproximado)
        'bus': [-22.9660, -43.1780],   // Terminal Gentileza (aproximado)
        'bus2': [-22.9665, -43.1870]   // Princesa Isabel (aproximado)
    };

    const destination = destinations[transportType];

    // Localizar o usuário e criar a rota
    map.locate({ setView: true, maxZoom: 17 });
    map.on('locationfound', function(e) {
        const userLocation = e.latlng; // Origem: localização do usuário

        // Adicionar controle de roteamento
        map.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(userLocation), // Ponto de origem
                L.latLng(destination)   // Ponto de destino baseado na seleção
            ],
            routeWhileDragging: true, // Permite ajustar a rota arrastando
            showAlternatives: true,   // Mostra rotas alternativas
            lineOptions: {
                styles: [{ color: '#4285F4', weight: 4, opacity: 0.8 }] // Estilo da linha da rota
            },
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: transportType === 'metro' ? 'foot' : 'driving' // 'foot' para metrô, 'driving' para ônibus
            }),
            createMarker: function(i, waypoint, n) {
                // Personalizar marcadores de origem e destino
                const markerIcon = i === 0 ?
                    L.icon({
                        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41]
                    }) :
                    L.icon({
                        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                        iconSize: [35, 56],
                        iconAnchor: [17, 56]
                    });
                return L.marker(waypoint.latLng, { icon: markerIcon });
            },
            language: 'pt', // Define o idioma das instruções como português
            show: true,     // Mostra as instruções de navegação
            collapsible: true // Permite colapsar as instruções
        }).addTo(map);

        // Ajustar o mapa para mostrar a rota inteira
        setTimeout(() => {
            const bounds = L.latLngBounds([userLocation, destination]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }, 500);

        console.log(`Rota criada de ${userLocation} para ${destination} usando ${transportType}`);
    });

    map.on('locationerror', function(e) {
        alert("Não foi possível encontrar sua localização para criar a rota. Verifique as permissões de localização.");
        console.error('Erro ao criar rota:', e);

        // Fallback: criar rota a partir de um ponto padrão (ex.: centro de Copacabana)
        const fallbackOrigin = [-22.9671, -43.1844];
        map.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(fallbackOrigin),
                L.latLng(destination)
            ],
            routeWhileDragging: true,
            showAlternatives: true,
            lineOptions: {
                styles: [{ color: '#4285F4', weight: 4, opacity: 0.8 }]
            },
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: transportType === 'metro' ? 'foot' : 'driving'
            }),
            language: 'pt',
            show: true,
            collapsible: true
        }).addTo(map);

        map.setView(fallbackOrigin, 15);
    });
});
document.querySelector('.vai-sozinho-btn').addEventListener('click', function() {
    window.open('http://linktr.ee/todomundonagrade', '_blank');
});
