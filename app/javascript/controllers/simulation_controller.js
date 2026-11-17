import { Controller } from "@hotwired/stimulus"

const WIDTH = 960
const HEIGHT = 560

export default class extends Controller {
  static targets = ["canvas", "historyCanvas", "toggleButton", "status", "statusDot", "time", "population", "herbivores", "predators"]

  connect() {
    this.canvasContext = this.canvasTarget.getContext("2d")
    this.historyContext = this.historyCanvasTarget.getContext("2d")
    this.running = false
    this.elapsed = 0
    this.lastFrame = null
    this.resetWorld()
  }

  disconnect() {
    this.running = false
    cancelAnimationFrame(this.frameId)
  }

  toggle() {
    this.running = !this.running
    this.toggleButtonTarget.textContent = this.running ? "Pausar simulação" : "Continuar simulação"
    this.statusTarget.textContent = this.running ? "Em execução" : "Em pausa"
    this.statusDotTarget.classList.toggle("is-running", this.running)
    this.lastFrame = null
    if (this.running) this.frameId = requestAnimationFrame((time) => this.animate(time))
  }

  reset() {
    this.running = false
    this.elapsed = 0
    this.toggleButtonTarget.textContent = "Iniciar simulação"
    this.statusTarget.textContent = "Em pausa"
    this.statusDotTarget.classList.remove("is-running")
    cancelAnimationFrame(this.frameId)
    this.resetWorld()
  }

  resetWorld() {
    this.organisms = []
    this.history = []
    this.historyAccumulator = 0
    for (let i = 0; i < 38; i++) this.organisms.push(this.createOrganism("herbivore"))
    for (let i = 0; i < 7; i++) this.organisms.push(this.createOrganism("predator"))
    this.updateStats()
    this.recordPopulation()
    this.draw()
    this.drawHistory()
  }

  createOrganism(type) {
    const angle = Math.random() * Math.PI * 2
    const speed = type === "predator" ? 20 + Math.random() * 18 : 12 + Math.random() * 18
    return { type, x: 24 + Math.random() * (WIDTH - 48), y: 24 + Math.random() * (HEIGHT - 48),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: type === "predator" ? 5.5 : 3.5,
      turnIn: 0.5 + Math.random() * 2 }
  }

  animate(timestamp) {
    if (!this.running) return
    const delta = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, 0.05) : 0
    this.lastFrame = timestamp
    this.elapsed += delta
    this.step(delta)
    this.draw()
    this.updateStats()
    this.historyAccumulator += delta
    if (this.historyAccumulator >= 1) {
      this.historyAccumulator %= 1
      this.recordPopulation()
      this.drawHistory()
    }
    this.frameId = requestAnimationFrame((time) => this.animate(time))
  }

  step(delta) {
    for (const organism of this.organisms) {
      organism.turnIn -= delta
      if (organism.turnIn <= 0) {
        const angle = Math.atan2(organism.vy, organism.vx) + (Math.random() - 0.5) * 1.5
        const speed = organism.type === "predator" ? 26 : 21
        organism.vx = Math.cos(angle) * speed
        organism.vy = Math.sin(angle) * speed
        organism.turnIn = 0.7 + Math.random() * 2
      }
      organism.x += organism.vx * delta
      organism.y += organism.vy * delta
      if (organism.x < 12 || organism.x > WIDTH - 12) organism.vx *= -1
      if (organism.y < 12 || organism.y > HEIGHT - 12) organism.vy *= -1
      organism.x = Math.max(12, Math.min(WIDTH - 12, organism.x))
      organism.y = Math.max(12, Math.min(HEIGHT - 12, organism.y))
    }

    // Predators consume nearby herbivores. After feeding, they may reproduce.
    for (const predator of this.organisms.filter((item) => item.type === "predator")) {
      const preyIndex = this.organisms.findIndex((item) => item.type === "herbivore" && Math.hypot(item.x - predator.x, item.y - predator.y) < 13)
      if (preyIndex >= 0) {
        this.organisms.splice(preyIndex, 1)
        predator.energy = (predator.energy || 0) + 1
        if (predator.energy >= 4 && this.organisms.filter((item) => item.type === "predator").length < 18) {
          this.organisms.push(this.createOrganism("predator"))
          predator.energy = 0
        }
      }
    }

    // Herbivores reproduce slowly while the population remains below its limit.
    this.reproductionTime = (this.reproductionTime || 0) + delta
    if (this.reproductionTime >= 4 && this.organisms.filter((item) => item.type === "herbivore").length < 90) {
      this.reproductionTime = 0
      const parents = this.organisms.filter((item) => item.type === "herbivore")
      if (parents.length) {
        const parent = parents[Math.floor(Math.random() * parents.length)]
        const offspring = this.createOrganism("herbivore")
        offspring.x = parent.x + (Math.random() - 0.5) * 24
        offspring.y = parent.y + (Math.random() - 0.5) * 24
        this.organisms.push(offspring)
      }
    }
  }

  draw() {
    const ctx = this.canvasContext
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = "#111813"
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.strokeStyle = "#ffffff08"
    ctx.lineWidth = 1
    for (let x = 40; x < WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke() }
    for (let y = 40; y < HEIGHT; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke() }
    for (const organism of this.organisms) {
      const predator = organism.type === "predator"
      ctx.beginPath()
      ctx.fillStyle = predator ? "#f18a63" : "#a9d583"
      ctx.shadowColor = predator ? "#f18a6388" : "#a9d58366"
      ctx.shadowBlur = predator ? 13 : 9
      ctx.arc(organism.x, organism.y, organism.radius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  updateStats() {
    const herbivores = this.organisms.filter((item) => item.type === "herbivore").length
    const predators = this.organisms.length - herbivores
    this.herbivoresTarget.textContent = herbivores
    this.predatorsTarget.textContent = predators
    this.populationTarget.textContent = this.organisms.length
    const seconds = Math.floor(this.elapsed)
    this.timeTarget.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
  }

  recordPopulation() {
    const herbivores = this.organisms.filter((item) => item.type === "herbivore").length
    const predators = this.organisms.length - herbivores
    this.history.push({ herbivores, predators })
    if (this.history.length > 60) this.history.shift()
  }

  drawHistory() {
    const ctx = this.historyContext
    const width = 960
    const height = 240
    const left = 48
    const right = 22
    const top = 18
    const bottom = 28
    const chartWidth = width - left - right
    const chartHeight = height - top - bottom
    const maxPopulation = Math.max(10, ...this.history.map((sample) => Math.max(sample.herbivores, sample.predators)))
    ctx.clearRect(0, 0, width, height)
    ctx.font = "11px 'DM Sans', sans-serif"
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    for (let mark = 0; mark <= 4; mark++) {
      const y = top + (chartHeight * mark) / 4
      const value = Math.round(maxPopulation * (1 - mark / 4))
      ctx.strokeStyle = "#ffffff10"
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(width - right, y)
      ctx.stroke()
      ctx.fillStyle = "#89968b"
      ctx.fillText(value, left - 10, y)
    }
    if (!this.history.length) return
    const line = (key, color) => {
      ctx.beginPath()
      this.history.forEach((sample, index) => {
        const x = left + (this.history.length === 1 ? 0 : (index / (this.history.length - 1)) * chartWidth)
        const y = top + chartHeight - (sample[key] / maxPopulation) * chartHeight
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
      ctx.stroke()
    }
    line("herbivores", "#a9d583")
    line("predators", "#f18a63")
    ctx.textAlign = "left"
    ctx.textBaseline = "bottom"
    ctx.fillStyle = "#89968b"
    ctx.fillText("início", left, height - 6)
    ctx.textAlign = "right"
    ctx.fillText("agora", width - right, height - 6)
  }
}
