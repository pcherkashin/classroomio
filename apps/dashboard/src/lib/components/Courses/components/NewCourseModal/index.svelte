<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ComingSoon from '$lib/components/ComingSoon/index.svelte';
  import { validateForm } from '$lib/components/Courses/functions';
  import { courses, createCourseModal } from '$lib/components/Courses/store';
  import TextArea from '$lib/components/Form/TextArea.svelte';
  import TextField from '$lib/components/Form/TextField.svelte';
  import Modal from '$lib/components/Modal/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { ROLE } from '$lib/utils/constants/roles';
  import { supabase } from '$lib/utils/functions/supabase';
  import { t } from '$lib/utils/functions/translations';
  import { addDefaultNewsFeed, addGroupMember } from '$lib/utils/services/courses';
  import { capturePosthogEvent } from '$lib/utils/services/posthog';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { COURSE_TYPE, COURSE_VERSION } from '$lib/utils/types';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import CheckmarkOutlineIcon from 'carbon-icons-svelte/lib/CheckmarkOutline.svelte';

  let isLoading = false;
  let errors = {
    title: '',
    description: ''
  };
  let step = 0;

  const options = [
    {
      title: 'Live Class',
      subtitle:
        'This course type is ideal for bootcamps where lessons are time based and you need attendance and grading',
      type: COURSE_TYPE.LIVE_CLASS,
      isDisabled: false
    },
    {
      title: 'Self Paced',
      subtitle:
        'This course type is ideal for courses where students can take lessons on their own pace without a teacher',
      type: COURSE_TYPE.SELF_PACED,
      isDisabled: false
    }
  ];
  let type = options[0].type;

  function onClose(redirectTo) {
    goto(redirectTo);

    createCourseModal.update(() => ({
      title: '',
      description: '',
      type: '',
      emails: '',
      tutors: '',
      students: ''
    }));
  }

  async function createCourse() {
    isLoading = true;
    const { hasError, fieldErrors } = validateForm($createCourseModal);

    errors = fieldErrors;
    if (hasError) return;

    const { title, description } = $createCourseModal;
    // 1. Create group
    const { data: newGroup } = await supabase
      .from('group')
      .insert({ name: title, description, organization_id: $currentOrg.id })
      .select();

    console.log(`newGroup`, newGroup);

    if (!newGroup) return;

    const { id: group_id } = newGroup[0];

    // 2. Create course with group_id
    const { data: newCourseData } = await supabase
      .from('course')
      .insert({
        title,
        description,
        type: type,
        version: COURSE_VERSION.V2,
        group_id
      })
      .select();
    console.log(`newCourse data`, newCourseData);

    if (!newCourseData) return;

    const newCourse = newCourseData[0];
    courses.update((_courses) => [..._courses, newCourse]);

    capturePosthogEvent('course_created', {
      course_id: newCourse.id,
      course_title: newCourse.title,
      course_description: newCourse.description,
      organization_id: $currentOrg.id,
      organization_name: $currentOrg.name,
      user_id: $profile.id,
      user_email: $profile.email
    });

    // 3. Add group members
    const { data } = await addGroupMember({
      profile_id: $profile.id,
      email: $profile.email,
      group_id,
      role_id: ROLE.TUTOR
    });

    // 4. Add default news feed.
    if (Array.isArray(data) && data.length) {
      const { id: authorId } = data[0];
      console.log('Add news feed into course');

      await addDefaultNewsFeed({
        content: `<h2>Welcome to this course 🎉&nbsp;</h2>
<p>Thank you for joining this course and I hope you get the best out of it.</p>`,
        course_id: newCourse.id,
        is_pinned: true,
        author_id: authorId
      });
    }

    onClose(`/courses/${newCourse.id}`);
    isLoading = false;
  }

  $: open = new URLSearchParams($page.url.search).get('create') === 'true';
</script>

<svelte:head>
  <title>Create a new course</title>
</svelte:head>

<Modal
  onClose={() => onClose($page.url.pathname)}
  bind:open
  width="w-4/5 md:w-2/5 md:min-w-[600px]"
  containerClass="max-w-2xl mx-auto"
  modalHeading={$t('courses.new_course_modal.heading')}
>
  {#if step === 0}
    <div>
      <h2 class="my-5 text-xl font-medium">
        {$t('courses.new_course_modal.type_selector_title')}
      </h2>

      <div class="my-8 flex flex-col items-center justify-evenly gap-4 md:flex-row">
        {#each options as option}
          <button
            class="w-11/12 rounded-md border-2 p-5 dark:bg-neutral-700 md:h-[240px] md:w-[261px] {option.type ===
            type
              ? 'border-primary-400'
              : `border-gray-200 dark:border-neutral-600 ${
                  !option.isDisabled && 'hover:scale-95'
                }`} flex flex-col {option.isDisabled &&
              'cursor-not-allowed opacity-60'} transition-all ease-in-out"
            type="button"
            on:click={!option.isDisabled ? () => (type = option.type) : undefined}
          >
            <div class="flex h-[70%] w-full flex-row-reverse">
              {#if option.type === type}
                <CheckmarkFilledIcon
                  size={16}
                  class="carbon-icon text-primary-600 dark:text-primary-200"
                />
              {:else if !option.isDisabled}
                <CheckmarkOutlineIcon size={16} class="carbon-icon" />
              {/if}
            </div>

            <div>
              <p class="flex items-center text-start font-bold">
                <span class="mr-2 text-sm">{option.title}</span>
                {#if option.isDisabled}
                  <ComingSoon />
                {/if}
              </p>
              <p class="text-start text-xs font-light">{option.subtitle}</p>
            </div>
          </button>
        {/each}
      </div>

      <div class="mt-8 flex flex-row-reverse items-center">
        <PrimaryButton
          className="px-6 py-3"
          label={$t('courses.new_course_modal.next')}
          onClick={() => (step = 1)}
          isDisabled={!type}
        />
      </div>
    </div>
  {:else}
    <form on:submit|preventDefault={createCourse}>
      <div class="mb-4 flex items-end space-x-2">
        <TextField
          label={$t('courses.new_course_modal.course_name')}
          bind:value={$createCourseModal.title}
          placeholder={$t('courses.new_course_modal.course_name_placeholder')}
          className="w-full "
          isRequired={true}
          errorMessage={errors.title}
          autoComplete={false}
        />
      </div>

      <TextArea
        label={$t('courses.new_course_modal.short_description')}
        bind:value={$createCourseModal.description}
        rows={4}
        placeholder={$t('courses.new_course_modal.short_description_placeholder')}
        className="mb-4"
        isRequired={true}
        errorMessage={errors.description}
        isAIEnabled={true}
        initAIPrompt="Write a 30 word description for a course titled: {$createCourseModal.title}"
      />

      <div class="mt-5 flex items-center justify-between">
        <PrimaryButton
          className="px-6 py-3"
          label={$t('courses.new_course_modal.back')}
          variant={VARIANTS.OUTLINED}
          onClick={() => (step = 0)}
        />
        <PrimaryButton
          className="px-6 py-3"
          label={$t('courses.new_course_modal.button')}
          type="submit"
          isDisabled={isLoading}
          {isLoading}
        />
      </div>
    </form>
  {/if}
</Modal>
