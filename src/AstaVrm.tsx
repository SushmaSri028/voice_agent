// 3D Asta: shows a VRoid Studio model (public/asta.vrm) with the same moods as the 2D drawing.
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import type { AstaMood } from './Asta'

type Props = {
  url: string
  mood: AstaMood
  walking: boolean
  waving: boolean
  rootRef: RefObject<HTMLDivElement | null> // Asta.tsx writes the mouth opening into --mouth here
}

const W = 180
const H = 260

export default function AstaVrm({ url, mood, walking, waving, rootRef }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ mood, walking, waving })
  useEffect(() => {
    stateRef.current = { mood, walking, waving }
  }, [mood, walking, waving])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 20)
    camera.position.set(0, 0.85, 3.6)
    camera.lookAt(0, 0.8, 0)

    const light = new THREE.DirectionalLight(0xffffff, Math.PI)
    light.position.set(1, 2, 2)
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.6))

    let vrm: VRM | null = null
    let disposed = false
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    loader.load(url, (gltf) => {
      if (disposed) return
      vrm = gltf.userData.vrm as VRM
      VRMUtils.removeUnnecessaryVertices(gltf.scene)
      VRMUtils.combineSkeletons(gltf.scene)
      VRMUtils.rotateVRM0(vrm) // older VRoid exports face the other way
      scene.add(vrm.scene)
    })

    const clock = new THREE.Clock()
    let nextBlink = 2
    let frame = 0

    const animate = () => {
      frame = requestAnimationFrame(animate)
      const dt = clock.getDelta()
      const t = clock.elapsedTime

      if (vrm) {
        const { mood, walking, waving } = stateRef.current
        const bone = (name: Parameters<NonNullable<VRM['humanoid']>['getNormalizedBoneNode']>[0]) =>
          vrm!.humanoid.getNormalizedBoneNode(name)
        const exp = vrm.expressionManager

        // Arms down (VRoid models load in a T-pose), gentle breathing
        const breathe = Math.sin(t * 2) * 0.03
        bone('leftUpperArm')!.rotation.z = -1.2 + breathe
        bone('rightUpperArm')!.rotation.z = 1.2 - breathe
        bone('spine')!.rotation.x = breathe * 0.5

        // Walking: swing legs and arms
        const swing = walking ? Math.sin(t * 9) * 0.5 : 0
        bone('leftUpperLeg')!.rotation.x = swing
        bone('rightUpperLeg')!.rotation.x = -swing
        bone('leftUpperArm')!.rotation.x = -swing * 0.6
        bone('rightUpperArm')!.rotation.x = swing * 0.6
        vrm.scene.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.03 : 0

        // Waving hello
        if (waving) {
          bone('rightUpperArm')!.rotation.z = -1.3
          bone('rightLowerArm')!.rotation.z = -0.4 + Math.sin(t * 12) * 0.5
        } else {
          bone('rightLowerArm')!.rotation.z = 0
        }

        // Head: tilt when thinking, lean in when listening, droop when asleep
        const head = bone('head')!
        head.rotation.z = mood === 'thinking' ? 0.18 : mood === 'listening' ? -0.08 : 0
        head.rotation.x = mood === 'sleeping' ? 0.35 : mood === 'listening' ? 0.08 : 0

        // Face
        if (exp) {
          const mouth = Number(rootRef.current?.style.getPropertyValue('--mouth') || 0)
          exp.setValue('aa', mood === 'speaking' ? mouth : 0)
          exp.setValue('happy', waving ? 0.8 : mood === 'speaking' ? 0.25 : 0)

          let blink = 0
          if (mood === 'sleeping') blink = 1
          else if (t > nextBlink) {
            blink = 1
            if (t > nextBlink + 0.12) nextBlink = t + 2 + Math.random() * 3
          }
          exp.setValue('blink', blink)
        }

        vrm.update(dt)
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      if (vrm) VRMUtils.deepDispose(vrm.scene)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [url, rootRef])

  return <div ref={mountRef} style={{ width: W, height: H }} />
}
