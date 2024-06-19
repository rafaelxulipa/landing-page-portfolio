import * as PIXI from "https://cdn.skypack.dev/pixi.js";
import { KawaseBlurFilter } from "https://cdn.skypack.dev/@pixi/filter-kawase-blur";
import SimplexNoise from "https://cdn.skypack.dev/simplex-noise";
import hsl from "https://cdn.skypack.dev/hsl-to-hex";
import debounce from "https://cdn.skypack.dev/debounce";

// retornar um número aleatório dentro de um intervalo
function random(min, max) {
  //return Math.random() * (max - min) + min;
  // === Client side ===
  const crypto = window.crypto || window.msCrypto;
  var array = new Uint32Array(1);
  return crypto.getRandomValues(array); // Compliant for security-sensitive use cases
}

// mapeie um número de um intervalo para outro
function map(n, start1, end1, start2, end2) {
  return ((n - start1) / (end1 - start1)) * (end2 - start2) + start2;
}

// Crie um novo simplex
const simplex = new SimplexNoise();

// ColorPalette class
class ColorPalette {
  constructor() {
    this.setColors();
    this.setCustomProperties();
  }

  setColors() {
    // escolha um matiz aleatório em algum lugar entre 220 e 360
    this.hue = ~~random(220, 360);
    this.complimentaryHue1 = this.hue + 30;
    this.complimentaryHue2 = this.hue + 60;
    // definir uma saturação e leveza fixas
    this.saturation = 95;
    this.lightness = 50;

    // define a base de cores
    this.baseColor = hsl(this.hue, this.saturation, this.lightness);
    // definir uma cor complementar, 30 graus de distância da base
    this.complimentaryColor1 = hsl(
      this.complimentaryHue1,
      this.saturation,
      this.lightness
    );
    // definir uma segunda cor complementar, 60 graus de distância da base
    this.complimentaryColor2 = hsl(
      this.complimentaryHue2,
      this.saturation,
      this.lightness
    );

    // armazene as opções de cores em uma matriz para que uma aleatória possa ser escolhida mais tarde
    this.colorChoices = [
      this.baseColor,
      this.complimentaryColor1,
      this.complimentaryColor2
    ];
  }

  randomColor() {
    // pega uma cor aleatória
    return this.colorChoices[~~random(0, this.colorChoices.length)].replace(
      "#",
      "0x"
    );
  }

  setCustomProperties() {
    // seta CSS customizado
    document.documentElement.style.setProperty("--hue", this.hue);
    document.documentElement.style.setProperty(
      "--hue-complimentary1",
      this.complimentaryHue1
    );
    document.documentElement.style.setProperty(
      "--hue-complimentary2",
      this.complimentaryHue2
    );
  }
}

// Orb class
class Orb {
  // Pixi usa cores hexadecimais como literais hexadecimais (0x em vez de uma string com '#')
  constructor(fill = 0x000000) {
    // limites = a área em que uma orbe "tem permissão" para se mover
    this.bounds = this.setBounds();
    // inicializar os valores {x, y} da orb em um ponto aleatório dentro de seus limites
    this.x = random(this.bounds["x"].min, this.bounds["x"].max);
    this.y = random(this.bounds["y"].min, this.bounds["y"].max);

    // quão grande é o orb vs seu raio original (isso vai se modular ao longo do tempo)
    this.scale = 1;

    // de que cor é a orb?
    this.fill = fill;

    // o raio original da orb, definido em relação à altura da janela
    this.radius = random(window.innerHeight / 6, window.innerHeight / 3);

    // pontos de partida no "tempo" para o ruído/valores aleatórios semelhantes
    this.xOff = random(0, 1000);
    this.yOff = random(0, 1000);
    // a rapidez com que o ruído/valores aleatórios semelhantes a si passam ao longo do tempo
    this.inc = 0.002;

    // PIXI.Graphics é usado para desenhar primitivos 2d (neste caso, um círculo) na tela
    this.graphics = new PIXI.Graphics();
    this.graphics.alpha = 0.825;

    // 250ms após o último evento de redimensionamento da janela, recalcule as posições das órbitas.
    window.addEventListener(
      "resize",
      debounce(() => {
        this.bounds = this.setBounds();
      }, 250)
    );
  }

  setBounds() {
    // quão longe da origem {x, y} cada orbe pode se mover
    const maxDist =
      window.innerWidth < 1000 ? window.innerWidth / 3 : window.innerWidth / 5;
    // a origem {x, y} de cada orbe (parte inferior direita da tela)
    const originX = window.innerWidth / 1.25;
    const originY =
      window.innerWidth < 1000
        ? window.innerHeight
        : window.innerHeight / 1.375;

    // permitir que cada orbe se mova para uma distância x de sua origem x/y
    return {
      x: {
        min: originX - maxDist,
        max: originX + maxDist
      },
      y: {
        min: originY - maxDist,
        max: originY + maxDist
      }
    };
  }

  update() {
    // auto-similares "pseudo-aleatórios" ou valores de ruído em um determinado ponto no "tempo"
    const xNoise = simplex.noise2D(this.xOff, this.xOff);
    const yNoise = simplex.noise2D(this.yOff, this.yOff);
    const scaleNoise = simplex.noise2D(this.xOff, this.yOff);

    // mapeie os valores xNoise / yNoise (entre -1 e 1) para um ponto dentro dos limites da orb
    this.x = map(xNoise, -1, 1, this.bounds["x"].min, this.bounds["x"].max);
    this.y = map(yNoise, -1, 1, this.bounds["y"].min, this.bounds["y"].max);
    // map scaleNoise (entre -1 e 1) para um valor de escala em algum lugar entre a metade do tamanho original da orbe e 100% de seu tamanho original
    this.scale = map(scaleNoise, -1, 1, 0.5, 1);

    // passo no "tempo"
    this.xOff += this.inc;
    this.yOff += this.inc;
  }

  render() {
    // atualizar a posição PIXI.Graphics e valores de escala
    this.graphics.x = this.x;
    this.graphics.y = this.y;
    this.graphics.scale.set(this.scale);

    // limpe qualquer coisa atualmente desenhada para gráficos
    this.graphics.clear();

    // diga aos gráficos para preencher quaisquer formas desenhadas depois disso com a cor de preenchimento da orb
    this.graphics.beginFill(this.fill);
    // desenhe um círculo em {0, 0} com seu tamanho definido por this.radius
    this.graphics.drawCircle(0, 0, this.radius);
    // deixe os gráficos saberem que não preencheremos mais formas
    this.graphics.endFill();
  }
}

// Criando PixiJS app
const app = new PIXI.Application({
  // renderizar para o <canvas class="orb-canvas"></canvas>
  view: document.querySelector(".orb-canvas"),
  // ajustar o tamanho para o tamanho da janela
  resizeTo: window,
  // fundo transparente, iremos criar um fundo gradiente mais tarde usando CSS
  transparent: true
});

// Criando paleta de cores
const colorPalette = new ColorPalette();

app.stage.filters = [new KawaseBlurFilter(30, 10, true)];

// Criando orbs
const orbs = [];

for (let i = 0; i < 10; i++) {
  const orb = new Orb(colorPalette.randomColor());

  app.stage.addChild(orb.graphics);

  orbs.push(orb);
}

// Animação
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  app.ticker.add(() => {
    orbs.forEach((orb) => {
      orb.update();
      orb.render();
    });
  });
} else {
  orbs.forEach((orb) => {
    orb.update();
    orb.render();
  });
}

document
  .querySelector(".overlay__btn--colors")
  .addEventListener("click", () => {
    colorPalette.setColors();
    colorPalette.setCustomProperties();

    orbs.forEach((orb) => {
      orb.fill = colorPalette.randomColor();
    });
  });