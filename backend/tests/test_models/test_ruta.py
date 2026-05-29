import pytest
from backend.models.ruta import RutaResponse, Coordenada, Parada

class TestRutaModels:
    def test_coordenada_model(self):
        """Prueba la creación de un modelo Coordenada"""
        # ARRANGE & ACT
        coordenada = Coordenada(orden=1, lat=21.91616, lng=-102.31644)
        
        # ASSERT
        assert coordenada.orden == 1
        assert coordenada.lat == 21.91616
        assert coordenada.lng == -102.31644
    
    def test_parada_model(self):
        """Prueba la creación de un modelo Parada"""
        # ARRANGE & ACT
        parada = Parada(orden =1,lat=21.91616, lng=-102.31644)
        
        # ASSERT
        assert parada.orden == 1
        assert parada.lat == 21.91616
        assert parada.lng == -102.31644
    
    def test_ruta_response_model(self):
        """Prueba la creación de un modelo RutaResponse completo"""
        # ARRANGE
        coordenadas = [
            Coordenada(orden=1, lat=21.91616, lng=-102.31644),
            Coordenada(orden=2, lat=21.91618, lng=-102.31611)
        ]
        
        paradas = [
            Parada(orden=1,lat=21.91616, lng=-102.31644),
            Parada(orden=2,lat=21.91700, lng=-102.31700)
        ]
        
        # ACT
        ruta = RutaResponse(
            nombre="40 Sur",
            coordenadas=coordenadas,
            tiempo_estimado=60,
            paradas=paradas
        )
        
        # ASSERT
        assert ruta.nombre == "40 Sur"
        assert ruta.tiempo_estimado == 60
        assert len(ruta.coordenadas) == 2
        assert len(ruta.paradas) == 2
        assert ruta.coordenadas[0].orden == 1
    
    def test_ruta_response_sin_paradas(self):
        """Prueba que RutaResponse funciona sin paradas"""
        # ARRANGE & ACT
        ruta = RutaResponse(
            nombre="40 Norte",
            coordenadas=[],
            tiempo_estimado=45,
            paradas=[]
        )
        
        # ASSERT
        assert ruta.nombre == "40 Norte"
        assert ruta.paradas == []