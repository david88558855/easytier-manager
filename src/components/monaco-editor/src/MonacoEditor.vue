<script setup lang="tsx">
import { useMonacoEditor } from '@/hooks/web/useMonacoEditor'
import { onMounted, computed, watch, ref } from 'vue'
import { ElSelect, ElOption, ElFormItem, ElForm } from 'element-plus'
import { languageOptions, themeOptions } from './config/config'

const props = withDefaults(
  defineProps<{
    width?: string | number
    height?: string | number
    languageSelector?: boolean
    language?: string
    themeSelector?: boolean
    theme?: string
    editorOption?: Object
    modelValue: string
    readOnly?: boolean //是否只读  取值 true | false
    wordWrap?: string // 开启自动换行
  }>(),
  {
    width: '100%',
    height: '100%',
    languageSelector: false,
    language: 'javascript',
    themeSelector: false,
    theme: 'vs-dark',
    editorOption: () => ({}),
    modelValue: '',
    readOnly: false, //是否只读  取值 true | false
    wordWrap: 'off' // 开启自动换行
  }
)

const emits = defineEmits<{
  (e: 'blur'): void
  (e: 'update:modelValue', val: string): void
}>()

const monacoEditorStyle = computed(() => {
  return {
    width: typeof props.width === 'string' ? props.width : props.width + 'px',
    height: typeof props.height === 'string' ? props.height : props.height + 'px'
  }
})

const {
  monacoEditorRef,
  createEditor,
  updateVal,
  updateOptions,
  getEditor,
  changeLanguage,
  changeTheme
} = useMonacoEditor(props.language)

onMounted(() => {
  const monacoEditor = createEditor(props)
  updateMonacoVal(props.modelValue)
  monacoEditor?.onDidChangeModelContent(() => {
    emits('update:modelValue', monacoEditor!.getValue())
    // 如果发生卡死，使用toRaw
    // toRaw(editor.value).setValue(props.value)
    // const currentValue = toRaw(editor.value).getValue()
    // props.onContentChange(currentValue)
  })
  monacoEditor?.onDidBlurEditorText(() => {
    emits('blur')
  })
})

watch(
  () => props.modelValue,
  () => {
    updateMonacoVal(props.modelValue)
  }
)

const localLanguage = ref(props.language)

watch(localLanguage, (newLanguage) => {
  changeLanguage(newLanguage)
})

const localTheme = ref(props.theme)
watch(localTheme, (newTheme) => {
  changeTheme(newTheme)
})

function updateMonacoVal(val: string) {
  if (val !== getEditor()?.getValue()) {
    updateVal(val)
  }
}

defineExpose({ updateOptions })
</script>

<template>
  <ElForm :inline="true">
    <ElFormItem v-if="languageSelector" label="language" class="w-30% mb-5px!">
      <ElSelect
        v-model="localLanguage"
        placeholder="Please select language"
        size="small"
        filterable
      >
        <ElOption
          v-for="item in languageOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
    <ElFormItem v-if="themeSelector" label="theme" class="w-30% mb-5px!">
      <ElSelect v-model="localTheme" placeholder="Please select language" size="small" filterable>
        <ElOption
          v-for="item in themeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>
  </ElForm>
  <div ref="monacoEditorRef" :style="monacoEditorStyle"></div>
</template>
