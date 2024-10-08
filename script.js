function initMap() {
  app.initMap();
}

const app = new Vue({
  el: "#app",
  data: {
    map: null,
    base: "https://laboratorio-python-fczdesenvolvime.replit.app",
    center: {
      lat: -22.9068,
      lng: -43.1729,
    },
    vetor: null,
    zoom: 16,
    gerencias: [],
    roteiros: [],
    tipos: [],
    listaLocais: [],
    locais: [],
    etrs: [],
    polilinhas: [],
    gerencia: null,
    roteiro: null,
    lado: "ED",
    opcao: null,
    isPopupVisible: false,
    pontos: [],
    deslocamento: 0,
    coleta: 0,
    distancia: 0,
    etr: 0,
    distanciaTotal: 0,
    inicio: null,
    fim: null,
    polilinha: null,
    tipo: null,
    local: null,
    primeiroMarcador: null,
    segundoMarcador: null,
    marcadores: [],
    retorno: true,
    showConfirmar: true,
  },
  mounted() {
    this.loadGerencias();
    this.loadLocais();
    this.loadEtrs();
  },
  watch: {
    polilinhas: function (newVal, oldVal) {
      this.renderizarPolilinha();
    },
    vetor: function () {
      this.tipo = null;
      this.local = null;
      if (this.vetor == "chegada") {
        this.opcao = "deslocamento";
      }
    },
  },
  methods: {
    initMap() {
      this.map = new google.maps.Map(document.getElementById("map"), {
        center: this.center,
        zoom: this.zoom,
        draggableCursor: "default", // Altera o cursor de pan para uma seta
        disableDoubleClickZoom: true, // Desabilita o zoom no duplo clique
      });

      const button = document.createElement("button");
      button.innerHTML = '<i class="fas fa-eye"></i>';
      button.classList.add("custom-map-control-button");
      button.addEventListener("click", this.togglePopup);

      this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(button);

      // Autocomplete Address
      const addressInput = document.getElementById("address");
      const autocomplete = new google.maps.places.Autocomplete(addressInput, {
        componentRestrictions: {
          country: "br",
        },
        fields: ["geometry", "name"],
        types: ["address"],
      });
      autocomplete.setBounds(
        new google.maps.LatLngBounds(
          new google.maps.LatLng(-23.0838, -43.7951),
          new google.maps.LatLng(-22.7428, -43.1036)
        )
      );
      autocomplete.bindTo("bounds", this.map);

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
          return;
        }

        if (place.geometry.viewport) {
          this.map.fitBounds(place.geometry.viewport);
        } else {
          this.map.setCenter(place.geometry.location);
          this.map.setZoom(17);
        }
      });

      // Add double click event listener
      this.map.addListener("dblclick", (e) => {
        this.duploCliqueMapa(e.latLng);
      });
    },
    adicionarMarcador(lat, lng, label, vetor) {
      const coords = new google.maps.LatLng(lat, lng);

      let url = null;

      switch (vetor) {
        case "partida":
          url = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
          break;
        case "chegada":
          url = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
          break;
        default:
          url = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
      }

      const customIcon = {
        url,
        scaledSize: new google.maps.Size(40, 40),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(10, 10),
      };

      const labelDiv = document.createElement("div");
      labelDiv.className = "map-marker-label";
      labelDiv.textContent = label;

      const overlay = new google.maps.OverlayView();
      overlay.onAdd = function () {
        const layer = this.getPanes().overlayLayer;
        layer.appendChild(labelDiv);
      };

      overlay.draw = function () {
        const projection = this.getProjection();
        const positionLatLng = new google.maps.LatLng(lat, lng);
        const positionPx = projection.fromLatLngToDivPixel(positionLatLng);

        labelDiv.style.left = positionPx.x + 0 + "px";
        labelDiv.style.top = positionPx.y - 10 + "px";
      };

      overlay.onRemove = function () {
        labelDiv.parentNode.removeChild(labelDiv);
      };

      overlay.setMap(this.map);

      const marker = new google.maps.Marker({
        position: {
          lat: lat,
          lng: lng,
        },
        icon: customIcon,
        map: this.map,
        id: vetor,
      });

      marker.addListener("dblclick", (event) => {
        /*
                Primeira coisa:
                Se existe uma polilinha após esse marcador inicial de PARTIDA esse marcador não pode ser removido
                */

        if (marker.id === "partida" && this.polilinhas.length > 1) {
          Swal.fire(
            "aviso",
            "Não é possível remover o marcador inicial de partida",
            "warning"
          );
          return;
        }

        /*
          Segunda coisa:
          Se não existe uma polilinha após esse marcador inicial de PARTIDA esse marcador  pode ser removido
        */

        if (marker.id === "partida" && this.polilinhas.length === 0) {
          this.apagarMarcadorPartida(marker, overlay);
          return;
        }

        /*
          Terceira coisa: 
          Para apagar a última polilinha, apagamos também a último trecho que conduzia até ele
        */

        if (marker.id === "chegada") {
          this.apagarMarcadorChegada(marker, overlay);
        }

        if (marker.id === "etr") {
          this.apagarMarcadorETR(marker, overlay);
        }
      });

      this.map.setCenter(coords);
      this.map.setZoom(17);
    },
    adicionarPonto(latLng) {
      const lat = latLng.lat();
      const lng = latLng.lng();
      this.pontos.push({
        lat,
        lng,
      });
      if (this.pontos.length > 2) {
        this.pontos.shift();
      }
    },
    apagarMarcadorChegada(marcadorChegada, overlay) {
      console.log(this.segundoMarcador);

      if (!!this.segundoMarcador) {
        Swal.fire("Oops!", `Essa rota já foi finalizada`, "warning");
        return;
      }

      Swal.fire({
        title: "Aviso",
        text: "Esse marcador será apagado. Deseja continuar?",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sim, faça isso!",
      }).then(async (result) => {
        if (result.isConfirmed) {
          marcadorChegada.setMap(null);
          overlay.setMap(null);

          /*
            Após remover a última polilinha, é necessário recarregar o mapa
          */
          this.initMap();

          /*
                        Após remover o marcador de chegada, é necessário apagar a polilinha que traça a rota até ele.
                        Essa polilinha é a última da lista de polilinhas.
                    */

          this.polilinhas.pop();

          /*
                        Então duas coisas precisam acontecer:
                            1) O marcador de início precisa ser colocado de volta e a polilinha precisa ser recarregada.
                            2) Porém, o this.polilinha temn um ouvinte e caso ainda haja elementos na polilinha será renderizado automaticamente na view.
                            3) Vamos precisar então avaliar qual será o último ponto disponível em this.pontos para recomeçar a marcação dos trechos.

                    */

          this.adicionarMarcador(
            this.primeiroMarcador.latitude,
            this.primeiroMarcador.longitude,
            this.primeiroMarcador.nome,
            this.primeiroMarcador.vetor
          );

          /*
            Caso já exista uma polilinha, o inicio do próximo percurso será o final dessa polilinha restante.
            Caso não haja mais polilinhas, então o inicio será o do próprio marcador de partida.
            Caso não haja marcador de partida, será obrigatório criar um novo
          */

          if (this.polilinhas.length > 0) {
            const { polilinha } = this.polilinhas[this.polilinhas.length - 1];
            this.adicionarPonto(polilinha[polilinha.length - 1]);
          } else {
            const coordenadas = new google.maps.LatLng(
              this.primeiroMarcador.latitude,
              this.primeiroMarcador.longitude
            );
            this.adicionarPonto(coordenadas);
          }

          this.tipo = null;
          this.local = null;
          this.segundoMarcador = null;

          Swal.fire("Feito!", "Marcador apagado.", "success");
        }
      });
    },
    apagarMarcadorPartida(marcadorPartida, overlay) {
      Swal.fire({
        title: "Aviso",
        text: "Esse marcador será apagado. Deseja continuar?",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sim, faça isso!",
      }).then(async (result) => {
        if (result.isConfirmed) {
          this.initMap();

          /*
                        Não basta remover apenas o marcador do mapa, é preciso zerar os pontos também.
                        Esses pontos são as coordenadas para buscar os trechos.
                        É necessário resetar tipo e local para forçar uma nova escolha.
                    */

          this.pontos = [];
          this.tipo = null;
          this.local = null;

          Swal.fire("Feito!", "Marcador apagado.", "success");
        }
      });
    },
    apagarMarcadorETR(marcadorETR, overlay) {
      console.log(this.segundoMarcador);

      if (!!this.segundoMarcador) {
        Swal.fire("Oops!", `Essa rota já foi finalizada`, "warning");
        return;
      }

      Swal.fire({
        title: "Aviso",
        text: "Esse marcador será apagado. Deseja continuar?",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sim, faça isso!",
      }).then(async (result) => {
        if (result.isConfirmed) {
          marcadorETR.setMap(null);
          overlay.setMap(null);

          /*
            Após remover a última polilinha, é necessário recarregar o mapa
          */
          this.initMap();

          /*
            Após remover o marcador de chegada, é necessário apagar a polilinha que traça a rota até ele.
            Essa polilinha é a última da lista de polilinhas.
          */

          this.polilinhas.pop();
          this.polilinhas.pop();

          /*
            Então duas coisas precisam acontecer:
            1) O marcador de início precisa ser colocado de volta e a polilinha precisa ser recarregada.
            2) Porém, o this.polilinha temn um ouvinte e caso ainda haja elementos na polilinha será renderizado automaticamente na view.
            3) Vamos precisar então avaliar qual será o último ponto disponível em this.pontos para recomeçar a marcação dos trechos.
           */

          this.adicionarMarcador(
            this.primeiroMarcador.latitude,
            this.primeiroMarcador.longitude,
            this.primeiroMarcador.nome,
            this.primeiroMarcador.vetor
          );

          /*
            Caso já exista uma polilinha, o inicio do próximo percurso será o final dessa polilinha restante.
            Caso não haja mais polilinhas, então o inicio será o do próprio marcador de partida.
            Caso não haja marcador de partida, será obrigatório criar um novo
          */

          if (this.polilinhas.length > 0) {
            const { polilinha } = this.polilinhas[this.polilinhas.length - 1];
            this.adicionarPonto(polilinha[polilinha.length - 1]);
          } else {
            const coordenadas = new google.maps.LatLng(
              this.primeiroMarcador.latitude,
              this.primeiroMarcador.longitude
            );
            this.adicionarPonto(coordenadas);
          }

          Swal.fire("Feito!", "Marcador apagado.", "success").then(() => {
            const url = `${this.base}/marcadores/${this.gerencia}/${this.roteiro}`;

            const config = {
              url,
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
            };

            axios(config).catch((error) =>
              Swal.fire("Erro", error.message, "error")
            );
          });
        }
      });
    },
    buscarRoteiro() {
      const url = `${this.base}/marcadores/${this.gerencia}/${this.roteiro}`;
      this.initMap();
      this.resetarVariaveis();

      axios
        .get(url)
        .then((response) => {
          const { status, data } = response;
          if (status === 200 || status === 201) {
            data.forEach((d) => {
              const { latitude, longitude, nome, vetor } = d;

              this.primeiroMarcador = d;

              this.adicionarMarcador(
                parseFloat(d.latitude),
                parseFloat(d.longitude),
                d.nome,
                d.vetor
              );

              vetor === "partida"
                ? (this.primeiroMarcador = d)
                : (this.segundoMarcador = d);
            });

            if (!!this.primeiroMarcador && !!this.segundoMarcador) {
              this.showConfirmar = false;
            }
          }
        })
        .then((data) => {
          const url = `${this.base}/coordenadas/${this.gerencia}/${this.roteiro}`;
          axios
            .get(url)
            .then((response) => {
              const { data, status } = response;
              if (status === 200 || status === 201) {
                data.forEach((d) => {
                  if (d.opcao == "deslocamento") {
                    this.deslocamento = this.deslocamento + d.distancia;
                  }

                  if (d.opcao == "coleta") {
                    this.coleta = this.coleta + d.distancia;
                  }

                  if (d.opcao == "etr") {
                    this.etr = this.etr + d.distancia;
                  }

                  this.distanciaTotal =
                    this.deslocamento + this.coleta + this.etr;
                  this.distancia = d.distancia;

                  d.polilinha = this.decodificarOverwiewPolyline(d.polilinha);
                  this.polilinhas.push(d);
                });

                this.polilinhas.sort((a, b) => a.uid - b.uid);

                if (this.polilinhas.length > 0) {
                  const latLng = this.polilinhas[0].polilinha[0];
                  this.map.setCenter(latLng);
                }
              }
            })
            .catch((error) =>
              Swal.fire("Erro no servidor", error.message, "error")
            );
        })
        .catch((error) =>
          Swal.fire("Erro no servidor", error.message, "error")
        );
    },
    async carregarMarcadorEtrs() {
      const index = this.listaLocais.findIndex(
        (local) => local.nome === this.local
      );
      const etr = this.listaLocais[index];

      if (!etr) {
        return;
      }

      const { nome, latitude, longitude } = etr;
      const latLng = new google.maps.LatLng(latitude, longitude);
      this.adicionarPonto(latLng);
      this.adicionarMarcador(latitude, longitude, nome, "etr");
      this.pegarTrecho();
      if (this.retorno === true) {
        const { lat, lng } = this.pontos[0];

        this.pontos[1] = { lat, lng };

        this.pontos[0] = {
          lat: latitude,
          lng: longitude,
        };

        this.pegarTrecho();
      }

      const marcador = {
        roteiro: this.roteiro,
        gerencia: this.gerencia,
        nome,
        latitude,
        longitude,
        vetor: "etr",
      };

      const url = `${this.base}/marcadores`;

      const config = {
        url,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: marcador,
      };

      await axios(config).catch((error) =>
        Swal.fire("Erro", error.message, "error")
      );
    },
    closePopup() {
      this.isPopupVisible = false;
    },
    criarIconeGoogleMaps(text, map, lat, long) {
      const position = new google.maps.LatLng(lat, long);
      const div = document.createElement("div");
      div.style.backgroundColor = "#1E90FF";
      div.style.color = "#FFFFFF";
      div.style.borderRadius = "50%";
      div.style.width = "21px";
      div.style.height = "21px";
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";
      div.style.fontSize = "14px";
      div.style.position = "absolute";
      div.style.zIndex = "1000"; // Garante que o ícone esteja sobre a polilinha
      div.textContent = text;

      const customIcon = new google.maps.OverlayView();
      customIcon.onAdd = function () {
        const layer = this.getPanes().overlayMouseTarget; // Garante que o overlay interaja com o mouse
        layer.appendChild(div);
      };
      customIcon.draw = function () {
        const projection = this.getProjection();
        const pos = projection.fromLatLngToDivPixel(position);
        div.style.left = pos.x - parseInt(div.style.width) / 2 + "px";
        div.style.top = pos.y - parseInt(div.style.height) / 2 + "px";
      };
      customIcon.onRemove = function () {
        if (div.parentNode) {
          div.parentNode.removeChild(div);
        }
      };
      customIcon.setMap(map);

      return {
        div: div, // Referência à div criada
        marker: customIcon, // Referência ao customIcon (marcador)
      };
    },
    criarPontoInicial() {
      if (!this.local) {
        return;
      }

      const local = this.listaLocais.filter((item) => item.nome === this.local);
      const { latitude, longitude, nome } = local[0];

      try {
        if (this.vetor === "partida") {
          this.primeiroMarcador = {
            latitude,
            longitude,
            nome,
            vetor: this.vetor,
          };
          const ponto = new google.maps.LatLng(latitude, longitude);
          this.adicionarPonto(ponto);
          this.adicionarMarcador(latitude, longitude, nome, this.vetor);
        } else {
          this.segundoMarcador = {
            latitude,
            longitude,
            nome,
            vetor: this.vetor,
          };
          const pontoPartida = new google.maps.LatLng(
            this.primeiroMarcador.latitude,
            this.primeiroMarcador.longitude
          );
          const pontoChegada = new google.maps.LatLng(
            this.segundoMarcador.latitude,
            this.segundoMarcador.longitude
          );
          this.adicionarMarcador(latitude, longitude, nome, this.vetor);

          if (this.polilinhas.length > 0) {
            const polys = this.polilinhas[this.polilinhas.length - 1];
            const { polilinha } = polys;
            this.adicionarPonto(polilinha[polilinha.length - 1]);
            this.adicionarPonto(pontoChegada);
            this.pegarTrecho();
          } else {
            this.adicionarPonto(pontoPartida);
            this.adicionarPonto(pontoChegada);
            this.pegarTrecho();
          }
        }
      } catch (e) {
        Swal.fire("Erro no sistema", "Repita a operação.", "error").then(
          location.reload()
        );
      }
    },
    criarQueryParams() {
      if (this.pontos.length < 2) {
        return;
      }

      const origin = `${this.pontos[0].lat},${this.pontos[0].lng}`;
      const destination = `${this.pontos[1].lat},${this.pontos[1].lng}`;
      const queryParams = `origin=${origin}&destination=${destination}`;
      return queryParams;
    },
    decodificarOverwiewPolyline(points) {
      return google.maps.geometry.encoding.decodePath(points);
    },
    duploCliqueMapa(latLng) {
      if (!this.testarDadosDoFormulario()) {
        return;
      }

      this.adicionarPonto(latLng);
      this.pegarTrecho();
    },
    extrairDadosDoPayload(data) {
      const { routes } = data;
      const { legs, overview_polyline } = routes[0];
      const { distance, end_address, start_address } = legs[0];
      const { points } = overview_polyline;
      const { value } = distance;

      if (this.opcao == "deslocamento") {
        this.deslocamento = this.deslocamento + value;
      }

      if (this.opcao == "coleta") {
        this.coleta = this.coleta + value;
      }

      if (this.opcao == "etr") {
        this.etr = this.etr + value;
      }

      this.distanciaTotal = this.deslocamento + this.coleta + this.etr;
      this.distancia = value;

      this.inicio = start_address;
      this.fim = end_address;
      this.polilinha = this.decodificarOverwiewPolyline(points);

      const obj = {
        inicio: this.inicio,
        fim: this.fim,
        polilinha: this.polilinha,
        distancia: this.distancia,
        lado: this.lado,
        opcao: this.opcao,
        uid: this.gerarUUIDv4(),
        id: Date.now(),
      };

      this.polilinhas.push(obj);
    },
    exportarTabelaParaExcel() {
      const dados = this.polilinhas.map((polilinha, index) => ({
        "#": index + 1,
        Logradouros: polilinha.inicio,
        Opção: polilinha.opcao,
        Laitude: polilinha.polilinha[0].lat(),
        Longitude: polilinha.polilinha[0].lng(),
      }));

      const planilha = XLSX.utils.json_to_sheet(dados);
      const pastaDeTrabalho = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        pastaDeTrabalho,
        planilha,
        "Dados da Tabela"
      );

      // Gerar o arquivo Excel e baixar
      XLSX.writeFile(
        pastaDeTrabalho,
        `${this.gerencia + "-" + this.roteiro}.xlsx`
      );
    },
    excluir() {
      const url = `${this.base}/marcadores/${this.gerencia}/${this.roteiro}`;

      const config = {
        url,
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      };

      Swal.fire({
        title: "Deseja remover esse roteiro?",
        text: "Essa ação não poderá ser desfeita",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sim, faça isso!",
      }).then(async (result) => {
        if (result.isConfirmed) {
          axios(config)
            .then(() => {
              const url = `${this.base}/marcadores/${this.gerencia}/${this.roteiro}`;
              const config = {
                url,
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                },
              };
            })
            .then(() => {
              const url = `${this.base}/coordenadas/${this.gerencia}/${this.roteiro}`;
              const config = {
                url,
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                },
              };

              axios(config)
                .then(() => {
                  Swal.fire(
                    "Sucesso",
                    "Trechos removidos com sucesso",
                    "success"
                  ).then(() => location.reload());
                })
                .catch((error) => Swal.fire("Erro", error.message, "error"));
            })
            .catch((error) => Swal.fire("Erro", error.message, "error"));
        }
      });
    },
    formataMedidas(medida) {
      const unidade = medida === 0 ? "metro" : medida < 1000 ? "metros" : "km";

      if (medida > 1000) {
        medida = (medida / 1000).toFixed(1);
      }

      const result = `${medida} ${unidade}`;
      return result;
    },
    gerarUUIDv4() {
      // Create an array of 16 bytes (128 bits)
      const cryptoObj = window.crypto || window.msCrypto; // for IE 11
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);

      // Set the version number (4)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Set the variant (1-0-1-0)
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      // Convert bytes to hex
      const hexBytes = Array.from(bytes, (byte) => {
        return byte.toString(16).padStart(2, "0");
      });

      // Insert hyphens to format the UUID
      return (
        hexBytes.slice(0, 4).join("") +
        "-" +
        hexBytes.slice(4, 6).join("") +
        "-" +
        hexBytes.slice(6, 8).join("") +
        "-" +
        hexBytes.slice(8, 10).join("") +
        "-" +
        hexBytes.slice(10, 16).join("")
      );
    },
    loadGerencias() {
      fetch(`${this.base}/gerencias`)
        .then((response) => response.json())
        .then((data) => {
          const gerencias = new Set();
          data.forEach((item) => {
            gerencias.add(item.gerencia);
          });
          this.gerencias = Array.from(gerencias);
          this.roteiros = data;
        });
    },
    loadLocais() {
      fetch(`${this.base}/locais`)
        .then((response) => response.json())
        .then((data) => {
          const tipos = new Set();
          const locais = new Set();
          const listaLocais = new Set();
          data.forEach((item) => {
            locais.add({
              nome: item.nome,
              tipo: item.tipo,
            });
            listaLocais.add(item);
            tipos.add(item.tipo);
          });

          this.locais = Array.from(locais);
          this.tipos = Array.from(tipos);
          this.listaLocais = Array.from(listaLocais);
        });
    },
    loadEtrs() {
      console.log(this.base);
      fetch(`${this.base}/etrs`)
        .then((response) => response.json())
        .then((data) => {
          const etrs = new Set();
          data.forEach((item) => {
            if (item.tipo == "ETR") {
              etrs.add(item.nome);
            }
          });

          this.etrs = Array.from(etrs);
        });
    },
    mudarParaColeta(uid, infowindow) {
      const index = this.polilinhas.findIndex((obj) => obj.uid === uid);
      const { distancia, opcao } = this.polilinhas[index];

      if (opcao === "coleta") {
        return;
      }

      this.deslocamento -= distancia;
      this.coleta += distancia;

      this.polilinhas = this.polilinhas.map((polyline, i) =>
        i === index
          ? {
              ...polyline,
              opcao: "coleta",
            }
          : polyline
      );

      infowindow.close();
    },
    mudarParaDeslocamento(uid, infowindow) {
      const index = this.polilinhas.findIndex((obj) => obj.uid === uid);
      const { distancia, opcao } = this.polilinhas[index];

      if (opcao === "deslocamento") {
        return;
      }

      this.deslocamento += distancia;
      this.coleta -= distancia;

      this.polilinhas = this.polilinhas.map((polyline, i) =>
        i === index
          ? {
              ...polyline,
              opcao: "deslocamento",
            }
          : polyline
      );

      infowindow.close();
    },
    pegarTrecho() {
      if (this.pontos.length < 2) {
        return;
      }

      const url = `https://laboratorio-python-fczdesenvolvime.replit.app/directions?${this.criarQueryParams()}`;

      axios
        .get(url)
        .then((response) => {
          this.extrairDadosDoPayload(response.data);
        })
        .catch((error) => console.log(error));
    },
    removerTrecho(uid, poly, infowindow, div, marker) {
      function removerMarcador(customIcon, div) {
        customIcon.setMap(null); // Remove o marcador do mapa
        if (div.parentNode) {
          div.parentNode.removeChild(div); // Remove o elemento div do DOM
        }
      }

      if (this.segundoMarcador !== null) {
        Swal.fire("Atenção", "Operação negada", "warning");
        return;
      }

      Swal.fire({
        title: "Aviso",
        text: "Esse marcador trecho será removido. Deseja continuar?",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sim, faça isso!",
      }).then(async (result) => {
        if (result.isConfirmed) {
          /*
                        Remover a polilinha da lista de polilinhas e do mapa.
                        Só será permitido remover a última linha da lista de polilinhas.
                    */

          const index = this.polilinhas.findIndex((obj) => obj.uid === uid);
          const { distancia, opcao } = this.polilinhas[index];

          if (opcao === "deslocamento") {
            this.deslocamento -= distancia;
          } else {
            this.coleta -= distancia;
          }

          this.distanciaTotal -= distancia;

          const len = this.polilinhas.length;

          if (index !== len - 1) {
            Swal.fire("aviso", "Não é possível remover o trecho", "warning");
            return;
          }

          poly.setMap(null);
          removerMarcador(marker, div);
          this.polilinhas.pop();

          /*
                        Agora será necessário atribuir o ultimo ponto da polilinha a última coordenada da nova última polilinha.
                        Se houver ainda auma polilinha, deve-se pegar o ultimo ponto dessa polilinha para setar as posições do this.pontos.
                        Caso não, deve ser utilizada a coordenada do marcador de partida.
                        Também deverá ser observado que a o deslocamento, a coleta e o total devem ser decrementado.							
                    */

          if (this.polilinhas.length > 0) {
            const { polilinha } = this.polilinhas[this.polilinhas.length - 1];
            this.adicionarPonto(polilinha[polilinha.length - 1]);
          } else {
            this.adicionarMarcador(
              this.primeiroMarcador.latitude,
              this.primeiroMarcador.longitude,
              this.primeiroMarcador.nome,
              this.primeiroMarcador.vetor
            );
            this.adicionarPonto(
              new google.maps.LatLng(
                this.primeiroMarcador.latitude,
                this.primeiroMarcador.longitude
              )
            );
          }

          infowindow.close();
          Swal.fire("Feito!", "Trecho removido.", "success");
        }
      });
    },
    renderizarPolilinha() {
      // Remover todas as polylines do mapa
      this.polilinhas.forEach((polylineObj) => {
        if (polylineObj.polyline) {
          polylineObj.polyline.setMap(null);
        }
      });

      // Adicionar novas polilines ao mapa
      this.polilinhas.forEach((polylineObj, index) => {
        const ultimaPosicao = polylineObj.polilinha.length - 1;
        const ponto = polylineObj.polilinha[ultimaPosicao];
        const { div, marker } = this.criarIconeGoogleMaps(
          index + 1,
          this.map,
          ponto.lat(),
          ponto.lng()
        );

        const polylineOptions = {
          path: polylineObj.polilinha,
          geodesic: true,
          strokeColor:
            polylineObj.opcao === "deslocamento"
              ? "blue"
              : polylineObj.opcao === "coleta"
              ? "red"
              : "green",
          strokeOpacity: 1.0,
          strokeWeight: polylineObj.opcao === "deslocamento" ? 4 : 5,
          icons:
            polylineObj.opcao !== "coleta"
              ? [
                  {
                    icon: {
                      path: "M 0,-1 0,1",
                      strokeOpacity: 1,
                      strokeColor: "white",
                      scale: 4,
                    },
                    offset: "0",
                    repeat: "20px",
                  },
                ]
              : [],
        };

        const polyline = new google.maps.Polyline(polylineOptions);

        polyline.addListener("rightclick", (event) => {
          const { uid } = polylineObj;
          const contentDiv = document.createElement("div");
          contentDiv.className = "popup-content";

          const button1 = document.createElement("button");
          button1.textContent = "Mudar para deslocamento";
          button1.dataset.uid = uid;
          button1.onclick = () => this.mudarParaDeslocamento(uid, infowindow);

          const button2 = document.createElement("button");
          button2.textContent = "Mudar para coleta";
          button2.dataset.uid = uid;
          button2.onclick = () => this.mudarParaColeta(uid, infowindow);

          const button3 = document.createElement("button");
          button3.textContent = "Remover trecho";
          button3.dataset.uid = uid;
          button3.onclick = () => {
            this.removerTrecho(uid, polyline, infowindow, div, marker);
          };

          contentDiv.appendChild(button1);
          contentDiv.appendChild(button2);
          contentDiv.appendChild(button3);

          const infowindow = new google.maps.InfoWindow({
            content: contentDiv,
            position: event.latLng,
          });

          infowindow.open(this.map);
        });
        polyline.setMap(this.map);
        // polylineObj.polyline = polyline;
      });
    },
    resetarVariaveis() {
      this.primeiroMarcador = null;
      this.segundoMarcador = null;
      this.polilinhas = [];
      this.pontos = [];
      this.deslocamento = 0;
      this.coleta = 0;
      this.distanciaTotal = 0;
      this.etr = 0;
    },
    async salvar() {
      const url = `${this.base}/coordenadas`;
      let response;

      if (
        !this.primeiroMarcador ||
        !this.segundoMarcador ||
        this.polilinha.length === 0
      ) {
        Swal.fire("Aviso", "Crie uma rota completa antes de salvar", "warning");
        return;
      }

      for (let data of this.polilinhas) {
        data.polilinha = google.maps.geometry.encoding.encodePath(
          data.polilinha
        );
        data.gerencia = this.gerencia;
        data.roteiro = this.roteiro;

        const config = {
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          data,
        };

        try {
          response = await axios(config);
        } catch (e) {
          Swal.fire("Erro no servidor", e.message, "error");
        }

        if (response.status === 200 || response.status === 201) {
        }
      }

      const { status } = response;
      if (status === 200 || status === 201) {
        Swal.fire("Sucesso", "Trechos salvos com sucesso", "success")
          .then(async () => {
            const { latitude, longitude, nome, vetor } = this.primeiroMarcador;

            const marcador = {
              gerencia: this.gerencia,
              roteiro: this.roteiro,
              latitude,
              longitude,
              nome,
              vetor,
            };

            const url = `${this.base}/marcadores`;

            const config = {
              url,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              data: marcador,
            };

            await axios(config).catch((error) =>
              Swal.fire("Erro", error.message, "error")
            );
          })
          .then(async () => {
            const { latitude, longitude, nome, vetor } = this.segundoMarcador;

            const marcador = {
              gerencia: this.gerencia,
              roteiro: this.roteiro,
              latitude,
              longitude,
              nome,
              vetor,
            };

            const url = `${this.base}/marcadores`;

            const config = {
              url,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              data: marcador,
            };

            await axios(config)
              .then(() => {})
              .catch((error) => Swal.fire("Erro", error.message, "error"));
          });
      }
    },
    testarDadosDoFormulario() {
      async function mostrarAvisoCampoAusente(campo) {
        Swal.fire("Oops!", `Preencha o campo ${campo}`, "warning");
      }

      if (!!this.segundoMarcador) {
        Swal.fire("Oops!", `Essa rota já foi finalizada`, "warning");
        return;
      }

      if (!this.gerencia) {
        mostrarAvisoCampoAusente("gerência");

        return false;
      } else if (!this.roteiro) {
        mostrarAvisoCampoAusente("roteiro");

        return false;
      } else if (!this.lado) {
        mostrarAvisoCampoAusente("lado");

        return false;
      } else if (!this.opcao) {
        mostrarAvisoCampoAusente("opção");

        return false;
      } else if (!this.vetor) {
        mostrarAvisoCampoAusente("partida");

        return false;
      } else if (!this.tipo) {
        mostrarAvisoCampoAusente("tipo");

        return false;
      } else if (!this.local) {
        mostrarAvisoCampoAusente("local");

        return false;
      } else {
        return true;
      }

      return true;
    },
    togglePopup() {
      this.isPopupVisible = !this.isPopupVisible;
      const button = document.querySelector(".custom-map-control-button i");
      button.className = this.isPopupVisible
        ? "fas fa-eye-slash"
        : "fas fa-eye";
    },
    updateLocais() {
      this.local = ""; // Reset the selected roteiro
    },
    updateRoteiros() {
      this.roteiro = ""; // Reset the selected roteiro
    },
  },
  computed: {
    filteredRoteiros() {
      return this.roteiros
        .filter((item) => item.gerencia === this.gerencia)
        .map((item) => item.roteiro);
    },
    filteredLocais() {
      return this.locais
        .filter((item) => item.tipo === this.tipo)
        .map((item) => item);
    },
    formatarDeslocamento() {
      return this.formataMedidas(this.deslocamento);
    },
    formatarETR() {
      return this.formataMedidas(this.etr);
    },
    formatarColeta() {
      return this.formataMedidas(this.coleta);
    },
    formatarDistanciaTotal() {
      this.distanciaTotal = this.deslocamento + this.coleta;
      return this.formataMedidas(this.distanciaTotal);
    },
  },
});
