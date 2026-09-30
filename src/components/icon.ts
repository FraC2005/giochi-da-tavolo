import { defineComponent, h, type Component, type PropType } from 'vue'

export const NIcon = defineComponent({
  name: 'NIcon',
  props: {
    component: { type: Object as PropType<Component>, required: true },
    size: { type: [Number, String], default: 20 },
  },
  setup(props, { attrs }) {
    return () =>
      h('span', { ...attrs, style: [{ display: 'inline-flex', width: props.size + 'px', height: props.size + 'px', fontSize: props.size + 'px', lineHeight: 1 }, attrs.style as any], 'aria-hidden': 'true' },
        h(props.component, { style: 'width:1em;height:1em' }))
  },
})
