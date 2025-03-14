/**
 * weather.js - Funcionalidades da previsão do tempo para o site "Todo Mundo No Rio"
 * Este script lida com a exibição e atualização das informações meteorológicas
 */

document.addEventListener('DOMContentLoaded', function() {
    // Chave da API do OpenWeatherMap
    const OPENWEATHER_API_KEY = '0acbbf2a7e9e0c157c4e02f13835378b';
    
    // Elementos da previsão do tempo
    const weatherToggle = document.querySelector('.weather-toggle');
    const weatherPanel = document.querySelector('.weather-panel');
    const weatherClose = document.querySelector('.weather-close');
    
    // Função para preencher o painel de previsão do tempo
    async function updateWeatherPanel() {
        // Coordenadas de Copacabana, Rio de Janeiro
        const lat = -22.9671;
        const lon = -43.1844;
        
        try {
            console.log('Buscando dados do clima...');
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${OPENWEATHER_API_KEY}`);
            
            if (!response.ok) {
                throw new Error(`Falha ao buscar previsão do tempo: ${response.status}`);
            }
            
            const weatherData = await response.json();
            console.log('Dados do clima recebidos:', weatherData);
            
            // Atualizar os elementos no painel
            // Temperatura arredondada
            document.getElementById('weather-temp').textContent = `${Math.round(weatherData.main.temp)}°C`;
            
            // Descrição do clima com primeira letra maiúscula
            const description = weatherData.weather[0].description;
            document.getElementById('weather-sky').textContent = description.charAt(0).toUpperCase() + description.slice(1);
            
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
            
            // Converter m/s para km/h (multiplicando por 3.6)
            document.getElementById('weather-wind').textContent = `${windDescription}, ${Math.round(windSpeed * 3.6)} km/h`;
            
            // Adicionar ícone do clima
            const iconContainer = document.getElementById('weather-icon-container');
            iconContainer.innerHTML = `<img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="Ícone do tempo" style="width: 80px; height: 80px;">`;
            
        } catch (error) {
            console.error('Erro ao atualizar painel de previsão do tempo:', error);
            
            // Mensagens de erro nos elementos
            document.getElementById('weather-temp').textContent = 'Indisponível';
            document.getElementById('weather-sky').textContent = 'Indisponível';
            document.getElementById('weather-rain').textContent = 'Indisponível';
            document.getElementById('weather-wind').textContent = 'Indisponível';
            
            // Ícone de erro
            const iconContainer = document.getElementById('weather-icon-container');
            iconContainer.innerHTML = '<i class="fas fa-exclamation-circle" style="font-size: 40px; color: #ffefae;"></i>';
        }
    }
    
    // Configurar eventos para o painel do clima
    if (weatherToggle && weatherPanel) {
        // Toggle para abrir/fechar o painel de previsão
        weatherToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Weather toggle clicado');
            
            // Alternar a classe active do painel
            weatherPanel.classList.toggle('active');
            
            // Se o painel estiver agora ativo, atualizar os dados
            if (weatherPanel.classList.contains('active')) {
                updateWeatherPanel();
                
                // Também atualizar o overlay se existir
                const overlay = document.querySelector('.overlay');
                if (overlay) {
                    overlay.classList.remove('hidden');
                }
            } else {
                // Esconder o overlay se existir
                const overlay = document.querySelector('.overlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                }
            }
            
            return false;
        });
        
        // Ação para o botão de fechar
        if (weatherClose) {
            weatherClose.addEventListener('click', function(e) {
                e.preventDefault();
                weatherPanel.classList.remove('active');
                
                // Esconder o overlay se existir
                const overlay = document.querySelector('.overlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                }
                
                console.log('Weather close clicado');
            });
        }
        
        // Fechar quando clicar no overlay
        const overlay = document.querySelector('.overlay');
        if (overlay) {
            overlay.addEventListener('click', function() {
                weatherPanel.classList.remove('active');
            });
        }
        
        console.log('Eventos de previsão do tempo configurados');
    } else {
        console.warn('Elementos de previsão do tempo não encontrados no DOM');
    }
    
    // Funções para previsão em pontos específicos do mapa
    window.fetchWeatherForPoint = async function(latitude, longitude) {
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
                    <img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="Ícone do tempo" style="width: 60px; display: block; margin: 0 auto;">
                    <p><strong>Temperatura:</strong> ${weatherData.main.temp.toFixed(1)}°C</p>
                    <p><strong>Sensação Térmica:</strong> ${weatherData.main.feels_like.toFixed(1)}°C</p>
                    <p><strong>Umidade:</strong> ${weatherData.main.humidity}%</p>
                    <p><strong>Condição:</strong> ${weatherData.weather[0].description}</p>
                    <p><strong>Vento:</strong> ${(weatherData.wind.speed * 3.6).toFixed(1)} km/h</p>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao buscar previsão do tempo para o ponto:', error);
            return `<div class="weather-popup">Previsão indisponível</div>`;
        }
    };
    
    // Eventos para dispositivos móveis
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile && weatherToggle) {
        // Adicionar feedback visual para toque em mobile
        weatherToggle.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        weatherToggle.addEventListener('touchend', function() {
            this.style.transform = '';
        });
    }
    
    // Chamada inicial para carregar dados do clima
    updateWeatherPanel();
    
    // Configurar atualização periódica a cada 30 minutos
    setInterval(updateWeatherPanel, 30 * 60 * 1000);
    
    // Expor a função updateWeatherPanel globalmente para uso por outros scripts
    window.updateWeatherPanel = updateWeatherPanel;
    
    console.log('Módulo de previsão do tempo inicializado');
});
/**
 * Adicione este código ao final do seu arquivo weather.js
 * ou no início do script.js principal
 */

// Script para corrigir o funcionamento do toggle de clima
document.addEventListener('DOMContentLoaded', function() {
    // Obter referências para os elementos
    const weatherToggle = document.querySelector('.weather-toggle');
    const weatherPanel = document.querySelector('.weather-panel');
    const overlay = document.querySelector('.overlay');
    
    // Verificar se os elementos existem
    if (weatherToggle && weatherPanel) {
        console.log('Aplicando correção para o toggle de clima');
        
        // Remover qualquer evento existente (para evitar duplicação)
        weatherToggle.removeEventListener('click', handleWeatherToggle);
        
        // Adicionar novo evento de clique
        weatherToggle.addEventListener('click', handleWeatherToggle);
        
        // Botão de fechar
        const weatherClose = document.querySelector('.weather-close');
        if (weatherClose) {
            weatherClose.removeEventListener('click', handleWeatherClose);
            weatherClose.addEventListener('click', handleWeatherClose);
        }
        
        // Fechar ao clicar no overlay
        if (overlay) {
            overlay.addEventListener('click', function() {
                weatherPanel.classList.remove('active');
            });
        }
        
        // Função para lidar com o clique no toggle
        function handleWeatherToggle(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Weather toggle clicado (correção)');
            
            // Alternar a classe active
            weatherPanel.classList.toggle('active');
            
            // Gerenciar overlay
            if (overlay) {
                if (weatherPanel.classList.contains('active')) {
                    overlay.classList.remove('hidden');
                } else {
                    overlay.classList.add('hidden');
                }
            }
            
            // Atualizar dados quando abrir
            if (weatherPanel.classList.contains('active') && window.updateWeatherPanel) {
                window.updateWeatherPanel();
            }
        }
        
        // Função para lidar com o clique no botão de fechar
        function handleWeatherClose(e) {
            e.preventDefault();
            weatherPanel.classList.remove('active');
            if (overlay) overlay.classList.add('hidden');
        }
        
        console.log('Correção do toggle de clima aplicada');
    } else {
        console.warn('Elementos de clima não encontrados para correção');
    }
    
    // Verificar estilos - diagnóstico para debugging
    setTimeout(function() {
        if (weatherPanel) {
            const styles = window.getComputedStyle(weatherPanel);
            console.log('Estilos do weatherPanel:', {
                display: styles.display,
                position: styles.position,
                transform: styles.transform,
                zIndex: styles.zIndex,
                bottom: styles.bottom,
                transition: styles.transition
            });
        }
        
        if (weatherToggle) {
            console.log('weatherToggle tem eventos:', weatherToggle.onclick !== null);
        }
    }, 1000);
});