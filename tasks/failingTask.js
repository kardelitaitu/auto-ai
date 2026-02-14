
export default async function failingTask(page, payload) {
  throw new Error('Task Error');
}
